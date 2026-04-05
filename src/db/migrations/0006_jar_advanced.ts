import type { Migration } from './types';

/**
 * Per-asset Jar distribution: default ceiling + default splits + milestone thresholds with splits.
 * Used when `user_settings.advanced_jar_enabled` is on; see `jarAdvanced` repository.
 */
export const migration0006JarAdvanced: Migration = {
  version: 6,
  name: 'jar_advanced_milestones',
  up: async (db) => {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS jar_advanced_assets (
  id TEXT PRIMARY KEY NOT NULL,
  currency TEXT NOT NULL UNIQUE,
  default_ceiling_minor INTEGER NOT NULL CHECK (default_ceiling_minor >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jar_advanced_default_splits (
  id TEXT PRIMARY KEY NOT NULL,
  asset_id TEXT NOT NULL,
  target_pocket_id TEXT NOT NULL,
  percent_bps INTEGER NOT NULL CHECK (percent_bps > 0 AND percent_bps <= 10000),
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES jar_advanced_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (target_pocket_id) REFERENCES pockets(id) ON DELETE CASCADE,
  UNIQUE (asset_id, target_pocket_id)
);

CREATE TABLE IF NOT EXISTS jar_advanced_milestones (
  id TEXT PRIMARY KEY NOT NULL,
  asset_id TEXT NOT NULL,
  threshold_minor INTEGER NOT NULL CHECK (threshold_minor > 0),
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES jar_advanced_assets(id) ON DELETE CASCADE,
  UNIQUE (asset_id, threshold_minor)
);

CREATE INDEX IF NOT EXISTS idx_jar_adv_milestones_asset ON jar_advanced_milestones (asset_id, threshold_minor ASC);

CREATE TABLE IF NOT EXISTS jar_advanced_milestone_splits (
  id TEXT PRIMARY KEY NOT NULL,
  milestone_id TEXT NOT NULL,
  target_pocket_id TEXT NOT NULL,
  percent_bps INTEGER NOT NULL CHECK (percent_bps > 0 AND percent_bps <= 10000),
  sort_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (milestone_id) REFERENCES jar_advanced_milestones(id) ON DELETE CASCADE,
  FOREIGN KEY (target_pocket_id) REFERENCES pockets(id) ON DELETE CASCADE,
  UNIQUE (milestone_id, target_pocket_id)
);
    `);
  },
};
