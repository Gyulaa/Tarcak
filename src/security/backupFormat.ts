/** Plaintext backup payload (encrypted inside the `.tarcak` file). */
export const BACKUP_PAYLOAD_VERSION = 1;

/** Human-readable list shown in Settings and stored in each export file. */
export const BACKUP_INCLUDES = [
  'All pockets (including the Jar) and every transaction',
  'Asset type catalog and app settings',
  'Basic Jar split rules and Advanced Jar per-asset rules',
  'Categories and per-transaction category tagging',
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
  /**
   * Raw on-disk SQLCipher-encrypted file bytes (read directly, not via `serializeAsync()`, which
   * returns decrypted in-memory pages and was the root cause of a historic import bug). Since this
   * is the whole physical database file, every table — including ones added by later migrations
   * (e.g. `categories`) — is captured automatically; nothing here needs updating per-table.
   */
  databaseB64: string;
  appearance?: BackupAppearanceSnapshot;
  contents?: BackupContentsManifest;
};
