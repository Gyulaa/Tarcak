import * as Crypto from 'expo-crypto';

import type { Migration } from './types';

/**
 * Single system Jar pocket (`is_jar = 1`) plus `jar_distribution_rules` for percent splits to regular pockets.
 */
export const migration0004Jar: Migration = {
  version: 4,
  name: 'jar_pocket_and_distribution_rules',
  up: async (db) => {
    await db.execAsync(`
ALTER TABLE pockets ADD COLUMN is_jar INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS jar_distribution_rules (
  id TEXT PRIMARY KEY NOT NULL,
  target_pocket_id TEXT NOT NULL,
  percent_bps INTEGER NOT NULL CHECK (percent_bps > 0 AND percent_bps <= 10000),
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (target_pocket_id) REFERENCES pockets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jar_rules_sort ON jar_distribution_rules (sort_index ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pockets_single_jar ON pockets (is_jar) WHERE is_jar = 1;
    `);

    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM pockets WHERE is_jar = 1 LIMIT 1`
    );
    if (existing) {
      return;
    }

    const now = Date.now();
    const id = Crypto.randomUUID();
    const row = await db.getFirstAsync<{ si: number }>(
      `SELECT COALESCE(MIN(sort_index), 0) - 1 AS si FROM pockets`
    );
    const sort_index = row?.si ?? -1;

    await db.runAsync(
      `INSERT INTO pockets (id, name, sort_index, created_at, updated_at, is_jar)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [id, 'Jar', sort_index, now, now]
    );
  },
};
