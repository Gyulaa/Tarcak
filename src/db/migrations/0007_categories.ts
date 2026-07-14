import type { Migration } from './types';

/**
 * User-defined transaction categories (e.g. Groceries, Salary), optionally attached to income and
 * expense transactions. Transfers never carry a category (enforced in `validateLedgerShape`, not SQL,
 * since ALTER TABLE cannot add a cross-column CHECK).
 */
export const migration0007Categories: Migration = {
  version: 7,
  name: 'categories',
  up: async (db) => {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON categories (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (sort_index ASC, name COLLATE NOCASE ASC);
    `);

    // ALTER TABLE ADD COLUMN has no "IF NOT EXISTS" in SQLite; guard it so a retried partial run
    // (see runner.ts's note on idempotent DDL) doesn't fail with "duplicate column name".
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(transactions)`);
    if (!cols.some((c) => c.name === 'category_id')) {
      await db.execAsync(`
ALTER TABLE transactions ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
      `);
    }
  },
};
