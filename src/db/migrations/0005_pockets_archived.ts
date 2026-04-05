import type { Migration } from './types';

/**
 * Archived pockets are hidden from picker lists and the Pockets screen; the Jar is archived when
 * "Pool & distribute" is turned off in Settings.
 */
export const migration0005PocketsArchived: Migration = {
  version: 5,
  name: 'pockets_archived_flag',
  up: async (db) => {
    await db.execAsync(`
ALTER TABLE pockets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
    `);
    // Users who turned Jar off before this column existed: align archive with setting.
    await db.execAsync(`
UPDATE pockets SET archived = 1
WHERE is_jar = 1
  AND EXISTS (
    SELECT 1 FROM user_settings
    WHERE key = 'jar_enabled' AND LOWER(TRIM(value)) IN ('0', 'false', 'no')
  );
    `);
  },
};
