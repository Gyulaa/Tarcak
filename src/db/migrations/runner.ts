import type { SQLiteDatabase } from 'expo-sqlite';

import { migration0001Initial } from './0001_initial';
import { migration0002AmountMinorScale } from './0002_amount_minor_scale';
import { migration0003AssetTypes } from './0003_asset_types';
import { migration0004Jar } from './0004_jar';
import { migration0005PocketsArchived } from './0005_pockets_archived';
import { migration0006JarAdvanced } from './0006_jar_advanced';
import type { Migration } from './types';

/**
 * All migrations in ascending `version` order. Append new modules here when the schema evolves.
 */
export const ALL_MIGRATIONS: readonly Migration[] = [
  migration0001Initial,
  migration0002AmountMinorScale,
  migration0003AssetTypes,
  migration0004Jar,
  migration0005PocketsArchived,
  migration0006JarAdvanced,
].sort(
  (a, b) => a.version - b.version
);

/**
 * Ledger of applied steps. Created before any versioned migration runs so the runner can
 * record completion atomically with the migration body.
 */
async function ensureMigrationsMetaTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);
  `);
}

async function getLatestAppliedVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_migrations'
  );
  return row?.v ?? 0;
}

/**
 * Apply every migration with `version` greater than the latest recorded in `schema_migrations`.
 * Safe to call on every `openMainDatabase()`; no-op when already up to date.
 *
 * Why: ship schema updates with the app without losing user data — old DB files upgrade in place.
 *
 * Note: We intentionally do **not** wrap `m.up()` in `withTransactionAsync`. In SQLite, `CREATE TABLE`
 * / `CREATE INDEX` issue an **implicit COMMIT**, which ends the surrounding transaction. Expo’s
 * wrapper would then run `COMMIT`/`ROLLBACK` with no active transaction →
 * "cannot rollback - no transaction is active". Migrations use idempotent DDL (`IF NOT EXISTS`) so
 * a partial run can be retried safely.
 */
export async function runPendingMigrations(db: SQLiteDatabase): Promise<void> {
  await ensureMigrationsMetaTable(db);
  let latest = await getLatestAppliedVersion(db);

  for (const m of ALL_MIGRATIONS) {
    if (m.version <= latest) {
      continue;
    }
    if (m.version !== latest + 1) {
      throw new Error(
        `Migration gap: latest applied is ${latest}, next file is ${m.version} (${m.name}). ` +
          `Add intermediate versions or fix ordering.`
      );
    }

    await m.up(db);
    await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      m.version,
      Date.now(),
    ]);

    latest = m.version;
  }
}
