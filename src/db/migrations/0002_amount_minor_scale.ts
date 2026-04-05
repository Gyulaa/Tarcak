import type { Migration } from './types';

import { LEGACY_MINOR_TO_CURRENT_MULTIPLIER } from '../../utils/amountMinor';

/**
 * Store amounts as 10^-8 of one major unit (integer minor). Allows signed income/expense
 * adjustments and values like 0.00000001. Transfers stay strictly positive in the DB.
 *
 * Existing v1 rows used 10^-2 per minor unit (e.g. cents); multiply by 10^6 to align.
 */
export const migration0002AmountMinorScale: Migration = {
  version: 2,
  name: 'amount_minor_10e8_scale_signed',
  up: async (db) => {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS transactions__v2 (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL
    CHECK (amount_minor != 0 AND (kind <> 'transfer' OR amount_minor > 0)),
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

INSERT INTO transactions__v2
SELECT
  id, kind, title,
  amount_minor * ${LEGACY_MINOR_TO_CURRENT_MULTIPLIER},
  currency, occurred_at, created_at, updated_at,
  pocket_id, from_pocket_id, to_pocket_id
FROM transactions;

DROP TABLE transactions;

ALTER TABLE transactions__v2 RENAME TO transactions;

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_pocket_id ON transactions (pocket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_pocket ON transactions (from_pocket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_pocket ON transactions (to_pocket_id);
    `);
  },
};
