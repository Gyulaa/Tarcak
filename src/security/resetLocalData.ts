/**
 * Nuclear option when the password is lost: remove vault metadata and delete the SQLite file.
 * There is no recovery — by design, the password is not stored anywhere else.
 */

import * as SQLite from 'expo-sqlite';

import { MAIN_DATABASE_NAME } from './constants';
import { lockVaultSession } from './lockdown';
import { wipeVaultFromSecureStore } from './keystore';

/**
 * Close any open DB handle, delete the encrypted database file, and clear SecureStore vault keys.
 * After this, `hasVault()` is false and the user can run `createFirstVault` again.
 */
export async function eraseAllLocalTarcakData(): Promise<void> {
  await lockVaultSession();
  try {
    await SQLite.deleteDatabaseAsync(MAIN_DATABASE_NAME);
  } catch {
    // Missing file (e.g. vault created but DB never written) — safe to ignore.
  }
  await wipeVaultFromSecureStore();
}
