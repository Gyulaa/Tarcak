import * as Crypto from 'expo-crypto';

import type { Migration } from './types';

/**
 * Catalog of asset / currency codes. `transactions.currency` must match a row here (enforced in repositories).
 * Seeds from existing transaction currencies, `default_currency` in settings, and at least `HUF`.
 */
export const migration0003AssetTypes: Migration = {
  version: 3,
  name: 'asset_types_catalog',
  up: async (db) => {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS asset_types (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_types_sort ON asset_types (sort_index ASC, code COLLATE NOCASE ASC);
    `);

    const codes = new Set<string>();
    const txRows = await db.getAllAsync<{ c: string | null }>(
      `SELECT DISTINCT UPPER(TRIM(currency)) AS c FROM transactions WHERE TRIM(currency) != ''`
    );
    for (const row of txRows) {
      if (row.c) {
        codes.add(row.c);
      }
    }
    const defRow = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM user_settings WHERE key = 'default_currency'`
    );
    if (defRow?.value) {
      const d = defRow.value.trim().toUpperCase();
      if (d) {
        codes.add(d);
      }
    }
    codes.add('HUF');

    const sorted = [...codes].sort((a, b) => a.localeCompare(b));
    const now = Date.now();
    let sortIndex = 0;
    for (const code of sorted) {
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM asset_types WHERE code = ?`,
        [code]
      );
      if (existing) {
        continue;
      }
      const id = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO asset_types (id, code, name, sort_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, code, code, sortIndex, now, now]
      );
      sortIndex += 1;
    }
  },
};
