/**
 * Central cryptographic parameters for the on-device vault.
 *
 * DEK  = data encryption key — 256-bit AES key used by SQLCipher for the SQLite file.
 * KEK  = key encryption key — derived from the user password; wraps the DEK only in SecureStore.
 *
 * Rationale:
 * - A random DEK means changing the password re-wraps the same DEK instead of re-encrypting the DB.
 * - PBKDF2-HMAC-SHA256 with a high iteration count follows OWASP guidance for password-based KDFs
 *   (see OWASP Password Storage Cheat Sheet — iteration counts are periodically updated; tune upward over time).
 */

/** SQLCipher / AES-256 expect a 32-byte (256-bit) key. */
export const DATA_KEY_LENGTH_BYTES = 32;

/**
 * Salt for PBKDF2 (password → KEK). 16 bytes (128 bits) is a common minimum for password salts.
 * This salt is stored in SecureStore (not secret, but must be unique per vault).
 */
export const PASSWORD_SALT_LENGTH_BYTES = 16;

/** AES-GCM standard nonce length (96 bits). A fresh nonce is generated for every wrap operation. */
export const GCM_NONCE_LENGTH_BYTES = 12;

/**
 * PBKDF2 iteration count (c). Higher = slower for attackers and for legitimate users on unlock.
 * **100,000** keeps create/unlock responsive on typical phones; raise for stronger offline resistance
 * (see OWASP Password Storage Cheat Sheet).
 */
export const PBKDF2_ITERATIONS = 100_000;

/** PBKDF2 output length: 32 bytes = AES-256 key size for KEK. */
export const PBKDF2_KEY_LENGTH_BYTES = 32;

/** First byte of wrapped DEK blob — allows future format changes without breaking old installs. */
export const WRAPPED_DEK_FORMAT_V1 = 0x01;

/**
 * Minimum password length (Unicode code points after NFKC normalization).
 * Short passwords are rejected before any KDF work.
 */
export const MIN_PASSWORD_LENGTH = 7;

/** expo-secure-store key names (alphanumeric + underscore only). */
export const SECURE_STORE_KEYS = {
  vaultFlag: 'tarcak_v1_vault_exists',
  passwordSalt: 'tarcak_v1_pbkdf2_salt',
  /** Decimal string; absent on vaults created before this key existed (unlock falls back to `PBKDF2_ITERATIONS`). */
  pbkdf2Iterations: 'tarcak_v1_pbkdf2_iterations',
  wrappedDek: 'tarcak_v1_wrapped_dek',
} as const;

/** Single persistent SQLite database file name (documents directory on device). */
export const MAIN_DATABASE_NAME = 'tarcak_main.db';
