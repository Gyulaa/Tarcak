/**
 * Marks a successful backup import so the UI can show what data came from the restore.
 * Pending marker lives in SecureStore until the next unlock writes into `user_settings`.
 */

import * as SecureStore from 'expo-secure-store';

import * as settingsRepo from '../db/repositories/settings';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const PENDING_RESTORED_AT = 'tarcak_pending_backup_restored_at';
const PENDING_SOURCE_EXPORTED_AT = 'tarcak_pending_backup_source_exported_at';

const KEY_RESTORED_AT = 'backup_restored_at';
const KEY_SOURCE_EXPORTED_AT = 'backup_source_exported_at';

export type BackupRestoreInfo = {
  restoredAt: number;
  sourceExportedAt: string;
};

export async function recordBackupRestored(sourceExportedAt: string): Promise<void> {
  const restoredAt = Date.now();
  await Promise.all([
    SecureStore.setItemAsync(PENDING_RESTORED_AT, String(restoredAt), OPTIONS),
    SecureStore.setItemAsync(PENDING_SOURCE_EXPORTED_AT, sourceExportedAt, OPTIONS),
  ]);
}

/** After unlock + DB open: persist banner fields in the restored database. */
export async function applyPendingBackupImportToSettings(): Promise<void> {
  const [restoredRaw, sourceExportedAt] = await Promise.all([
    SecureStore.getItemAsync(PENDING_RESTORED_AT, OPTIONS),
    SecureStore.getItemAsync(PENDING_SOURCE_EXPORTED_AT, OPTIONS),
  ]);
  if (!restoredRaw || !sourceExportedAt) {
    return;
  }
  await settingsRepo.setSetting(KEY_RESTORED_AT, restoredRaw);
  await settingsRepo.setSetting(KEY_SOURCE_EXPORTED_AT, sourceExportedAt);
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_RESTORED_AT, OPTIONS),
    SecureStore.deleteItemAsync(PENDING_SOURCE_EXPORTED_AT, OPTIONS),
  ]);
}

export async function getBackupRestoreInfo(): Promise<BackupRestoreInfo | null> {
  const [restoredRaw, sourceExportedAt] = await Promise.all([
    settingsRepo.getSetting(KEY_RESTORED_AT),
    settingsRepo.getSetting(KEY_SOURCE_EXPORTED_AT),
  ]);
  if (!restoredRaw || !sourceExportedAt) {
    return null;
  }
  const restoredAt = Number.parseInt(restoredRaw, 10);
  if (!Number.isFinite(restoredAt)) {
    return null;
  }
  return { restoredAt, sourceExportedAt };
}

export async function clearBackupRestoreInfo(): Promise<void> {
  await settingsRepo.setSetting(KEY_RESTORED_AT, '');
  await settingsRepo.setSetting(KEY_SOURCE_EXPORTED_AT, '');
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_RESTORED_AT, OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync(PENDING_SOURCE_EXPORTED_AT, OPTIONS).catch(() => {}),
  ]);
}
