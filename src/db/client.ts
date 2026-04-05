/**
 * Encrypted SQLite (SQLCipher) open/close helpers.
 *
 * Expo Go ships standard SQLite without SQLCipher — the official docs state SQLCipher is not
 * available there. In that case we still open the DB for development, but the file is NOT
 * encrypted at rest. Release builds created with `expo prebuild` + `useSQLCipher: true` use
 * PRAGMA key with the session DEK.
 *
 * Web: not targeted for encrypted native file storage; we skip PRAGMA and warn.
 */

import * as SQLite from 'expo-sqlite';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { MAIN_DATABASE_NAME } from '../security/constants';
import { getSessionDataKeyOrThrow } from '../security/session';
import { runPendingMigrations } from './migrations/runner';
import { buildRawKeyPragmaSql } from './sqlcipher';

let cachedDb: SQLite.SQLiteDatabase | null = null;

/**
 * In-flight open promise so concurrent callers (e.g. Zustand refresh + create pocket) share one
 * `openDatabaseAsync` sequence. Without this, Android can open the same file twice and later
 * `prepareAsync` hits a null native handle (NPE).
 */
let openingPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * True when the native binary is expected to include SQLCipher (dev client / standalone / bare).
 * False for Expo Go and web.
 */
export function isSqlCipherAvailableInThisBuild(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  // Expo Go = StoreClient — stock SQLite only.
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

async function openMainDatabaseWork(): Promise<SQLite.SQLiteDatabase> {
  const dek = getSessionDataKeyOrThrow();
  const db = await SQLite.openDatabaseAsync(MAIN_DATABASE_NAME);

  if (isSqlCipherAvailableInThisBuild()) {
    const pragmaSql = buildRawKeyPragmaSql(dek);
    await db.execAsync(pragmaSql);
    // Verify the key actually matches the file (corruption / wrong key shows up here).
    await db.getFirstAsync<{ ok: number }>('SELECT 1 AS ok');
  } else {
    console.warn(
      '[Tarcak] SQLCipher is not active in this build (e.g. Expo Go). ' +
        'The database file is not encrypted at rest. Use a dev build with useSQLCipher for real protection.'
    );
  }

  // SQLite defaults foreign keys OFF; we rely on ON DELETE RESTRICT for pocket integrity.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Bring file to current schema (idempotent after first run).
  await runPendingMigrations(db);

  cachedDb = db;
  return db;
}

/**
 * Open (or reuse) the main app database. Requires an unlocked session (DEK in memory).
 * Idempotent until `closeMainDatabase` is called.
 */
export async function openMainDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (cachedDb) {
    return cachedDb;
  }
  if (!openingPromise) {
    openingPromise = openMainDatabaseWork().finally(() => {
      openingPromise = null;
    });
  }
  return openingPromise;
}

/**
 * Close the DB and drop the cached handle. Safe to call when already closed.
 */
export async function closeMainDatabase(): Promise<void> {
  if (openingPromise) {
    try {
      await openingPromise;
    } catch {
      /* open failed — still clear state below */
    }
  }
  if (cachedDb) {
    await cachedDb.closeAsync();
    cachedDb = null;
  }
  openingPromise = null;
}
