import type { Migration } from './types';

/**
 * Optional per-asset display precision (0–8 decimals). NULL means the automatic, size-based rule
 * (`autoDisplayDecimals`). Display only: stored amounts keep their full 10^-8 precision.
 */
export const migration0008AssetDisplayDecimals: Migration = {
  version: 8,
  name: 'asset_display_decimals',
  up: async (db) => {
    // Guarded like 0007: ALTER TABLE ADD COLUMN has no "IF NOT EXISTS" in SQLite.
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(asset_types)`);
    if (!cols.some((c) => c.name === 'display_decimals')) {
      await db.execAsync(`
ALTER TABLE asset_types ADD COLUMN display_decimals INTEGER
  CHECK (display_decimals IS NULL OR (display_decimals BETWEEN 0 AND 8));
      `);
    }
  },
};
