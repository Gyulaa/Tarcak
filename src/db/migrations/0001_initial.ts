import type { Migration } from './types';

/**
 * Initial schema: pockets, ledger transactions, user settings.
 *
 * `transactions` rows are the single source of truth for balances (derived in queries).
 * CHECK constraints encode the README invariants for income / expense / transfer linkage.
 *
 * FK ON DELETE RESTRICT: deleting a pocket that is still referenced by a transaction fails,
 * which avoids silent balance corruption.
 */
export const migration0001Initial: Migration = {
  version: 1,
  name: 'initial_pockets_transactions_settings',
  up: async (db) => {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS pockets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  pocket_id TEXT REFERENCES pockets(id) ON DELETE RESTRICT,
  from_pocket_id TEXT REFERENCES pockets(id) ON DELETE RESTRICT,
  to_pocket_id TEXT REFERENCES pockets(id) ON DELETE RESTRICT,
  CHECK (
    (
      kind = 'income'
      AND pocket_id IS NOT NULL
      AND from_pocket_id IS NULL
      AND to_pocket_id IS NULL
    )
    OR (
      kind = 'expense'
      AND pocket_id IS NOT NULL
      AND from_pocket_id IS NULL
      AND to_pocket_id IS NULL
    )
    OR (
      kind = 'transfer'
      AND pocket_id IS NULL
      AND from_pocket_id IS NOT NULL
      AND to_pocket_id IS NOT NULL
      AND from_pocket_id <> to_pocket_id
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_pocket_id ON transactions (pocket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_pocket ON transactions (from_pocket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_pocket ON transactions (to_pocket_id);

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
    `);

    await db.runAsync(
      `INSERT OR REPLACE INTO user_settings (key, value) VALUES ('default_currency', ?)`,
      ['HUF']
    );
  },
};
