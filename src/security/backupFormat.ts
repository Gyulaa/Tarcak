/** Plaintext backup payload (encrypted inside the `.tarcak` file). */
export const BACKUP_PAYLOAD_VERSION = 1;

/** Human-readable list shown in Settings and stored in each export file. */
export const BACKUP_INCLUDES = [
  'All pockets (including the Jar) and every transaction',
  'Asset type catalog and app settings',
  'Basic Jar split rules and Advanced Jar per-asset rules',
  'Appearance choice (dark mode + accent palette)',
] as const;

export type BackupContentsManifest = {
  summary: string;
  includes: readonly string[];
};

export type BackupVaultSnapshot = {
  passwordSaltB64: string;
  wrappedDekB64: string;
  pbkdf2Iterations: string;
};

export type BackupAppearanceSnapshot = {
  isDark: boolean;
  colorThemeId: string;
};

export type BackupPayloadV1 = {
  payloadVersion: typeof BACKUP_PAYLOAD_VERSION;
  exportedAt: string;
  vault: BackupVaultSnapshot;
  /** SQLCipher database bytes from `SQLiteDatabase.serializeAsync()`. */
  databaseB64: string;
  appearance?: BackupAppearanceSnapshot;
  contents?: BackupContentsManifest;
};
