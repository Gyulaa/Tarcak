/**
 * Encrypted portable backup: SQLCipher file + vault metadata, wrapped with a backup password.
 *
 * - **Vault password** (unchanged): unlocks the app after restore.
 * - **Backup password**: encrypts the `.tarcak` file at rest (cloud, USB, email).
 */

import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { defaultDatabaseDirectory } from 'expo-sqlite';

import { openMainDatabase } from '../db/client';
import { readAppearanceCache, writeAppearanceCache } from '../theme/appearanceCache';
import { normalizeColorThemeId } from '../theme/colorThemes';
import {
  BACKUP_INCLUDES,
  BACKUP_PAYLOAD_VERSION,
  type BackupPayloadV1,
} from './backupFormat';
import { recordBackupRestored } from './backupImportMeta';
import {
  backupBase64ToBytes,
  backupBytesToBase64,
  decryptBackupPayloadUtf8,
  encryptBackupPayloadUtf8,
} from './backupCrypto';
import { MAIN_DATABASE_NAME } from './constants';
import { uint8ArrayToBase64 } from './encoding';
import { VaultCryptoError } from './errors';
import { lockVaultSession } from './lockdown';
import {
  readVaultSnapshotForBackup,
  restoreVaultFromSnapshot,
} from './keystore';
import { assertPasswordAcceptable } from './passwordPolicy';

const BACKUP_EXTENSION = '.tarcak';

function buildExportFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `tarcak-backup-${stamp}${BACKUP_EXTENSION}`;
}

/** expo-sqlite directory is often a plain path; File.write on Android needs a file:// URI. */
function buildMainDatabaseFileUri(): string {
  const dir = defaultDatabaseDirectory;
  if (dir == null || String(dir).trim() === '') {
    throw new VaultCryptoError('Database directory is not available on this platform.');
  }
  const dirStr = String(dir).replace(/\/+$/, '');
  const filePath = `${dirStr}/${MAIN_DATABASE_NAME}`;
  if (filePath.startsWith('file://')) {
    return filePath;
  }
  if (filePath.startsWith('/')) {
    return `file://${filePath}`;
  }
  const doc = FileSystem.documentDirectory;
  if (!doc) {
    throw new VaultCryptoError('Document directory is not available on this platform.');
  }
  return `${doc}${dirStr.replace(/^\/+/, '')}/${MAIN_DATABASE_NAME}`;
}

/**
 * Read the on-disk SQLCipher-encrypted database file as raw bytes.
 *
 * serializeAsync('main') returns the *decrypted* in-memory pages — a plain SQLite file.
 * Reading the file directly gives us the already-encrypted SQLCipher bytes, which can be
 * written back verbatim on restore and opened normally with PRAGMA key.
 */
async function readMainDatabaseBytes(): Promise<Uint8Array> {
  const file = new File(buildMainDatabaseFileUri());
  const b64 = await file.base64();
  return backupBase64ToBytes(b64);
}

function parentDirectoryUri(fileUri: string): string {
  const idx = fileUri.lastIndexOf('/');
  return idx > 0 ? fileUri.slice(0, idx + 1) : fileUri;
}

/** Document-picker URIs on Android may be content:// — copy into cache for a stable file:// read. */
async function resolveReadableBackupUri(fileUri: string): Promise<string> {
  if (!fileUri.startsWith('content://')) {
    return fileUri;
  }
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    throw new VaultCryptoError('Cannot read backup: cache directory unavailable.');
  }
  const dest = `${cache}tarcak-import-${Date.now()}${BACKUP_EXTENSION}`;
  await FileSystem.copyAsync({ from: fileUri, to: dest });
  return dest;
}

async function readBackupFileBytes(fileUri: string): Promise<Uint8Array> {
  const readableUri = await resolveReadableBackupUri(fileUri);
  const infile = new File(readableUri);
  const b64 = await infile.base64();
  return backupBase64ToBytes(b64);
}

function parsePayloadV1(json: string): BackupPayloadV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new VaultCryptoError('Backup payload is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new VaultCryptoError('Backup payload is invalid.');
  }
  const p = parsed as BackupPayloadV1;
  if (p.payloadVersion !== BACKUP_PAYLOAD_VERSION) {
    throw new VaultCryptoError('Unsupported backup payload version.');
  }
  if (!p.vault?.passwordSaltB64 || !p.vault?.wrappedDekB64 || !p.vault?.pbkdf2Iterations) {
    throw new VaultCryptoError('Backup is missing vault metadata.');
  }
  if (!p.databaseB64 || typeof p.databaseB64 !== 'string') {
    throw new VaultCryptoError('Backup is missing database data.');
  }
  return p;
}

/**
 * Create an encrypted `.tarcak` file in the cache directory and return its URI for sharing.
 */
export async function exportEncryptedBackup(backupPassword: string): Promise<string> {
  assertPasswordAcceptable(backupPassword);

  const db = await openMainDatabase();

  // Flush any WAL data into the main file before reading it (no-op for DELETE journal mode).
  await db.execAsync('PRAGMA wal_checkpoint(FULL)');

  const [dbBytes, vault, appearance] = await Promise.all([
    readMainDatabaseBytes(),
    readVaultSnapshotForBackup(),
    readAppearanceCache(),
  ]);

  const payload: BackupPayloadV1 = {
    payloadVersion: BACKUP_PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    vault,
    databaseB64: uint8ArrayToBase64(dbBytes),
    appearance: {
      isDark: appearance.isDark,
      colorThemeId: appearance.colorThemeId,
    },
    contents: {
      summary: 'Full encrypted snapshot of this vault',
      includes: [...BACKUP_INCLUDES],
    },
  };

  const payloadUtf8 = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await encryptBackupPayloadUtf8(backupPassword, payloadUtf8);

  const outfile = new File(Paths.cache, buildExportFilename());
  outfile.write(backupBytesToBase64(encrypted), { encoding: 'base64' });
  return outfile.uri;
}

async function writeDatabaseBytesToDisk(dbBytes: Uint8Array): Promise<void> {
  const uri = buildMainDatabaseFileUri();
  const parent = parentDirectoryUri(uri);
  try {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  } catch {
    /* directory may already exist */
  }
  await FileSystem.writeAsStringAsync(uri, uint8ArrayToBase64(dbBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Replace local vault + database from an encrypted backup file.
 * Decrypts while the session is still open; locks afterward so the user re-unlocks with the
 * vault password from the backup (unchanged).
 */
export async function importEncryptedBackup(fileUri: string, backupPassword: string): Promise<void> {
  assertPasswordAcceptable(backupPassword);

  const fileBytes = await readBackupFileBytes(fileUri);
  const payloadUtf8 = await decryptBackupPayloadUtf8(backupPassword, fileBytes);
  const json = new TextDecoder().decode(payloadUtf8);
  const payload = parsePayloadV1(json);
  const dbBytes = backupBase64ToBytes(payload.databaseB64);

  if (dbBytes.length < 16) {
    throw new VaultCryptoError('Database section in backup is empty or corrupt.');
  }

  await lockVaultSession();

  try {
    await SQLite.deleteDatabaseAsync(MAIN_DATABASE_NAME);
  } catch {
    /* missing file */
  }

  await restoreVaultFromSnapshot(payload.vault);
  await writeDatabaseBytesToDisk(dbBytes);

  if (payload.appearance) {
    await writeAppearanceCache({
      isDark: !!payload.appearance.isDark,
      colorThemeId: normalizeColorThemeId(payload.appearance.colorThemeId),
    });
  }

  await recordBackupRestored(payload.exportedAt);
}

export { BACKUP_EXTENSION, BACKUP_INCLUDES };
