/** Plaintext backup payload (encrypted inside the `.tarcak` file). */
export const BACKUP_PAYLOAD_VERSION = 1;

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
};
