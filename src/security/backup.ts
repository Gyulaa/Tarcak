/**
 * Encrypted portable backup: SQLCipher file + vault metadata, wrapped with a backup password.
 *
 * - **Vault password** (unchanged): unlocks the app after restore.
 * - **Backup password**: encrypts the `.tarcak` file at rest (cloud, USB, email).
 */

import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
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
import {
  DATA_KEY_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
  MAIN_DATABASE_NAME,
  PASSWORD_SALT_LENGTH_BYTES,
  PBKDF2_ITERATIONS_MAX,
  PBKDF2_ITERATIONS_MIN,
  WRAPPED_DEK_FORMAT_V1,
} from './constants';
import { base64ToUint8Array, uint8ArrayToBase64 } from './encoding';
import { VaultCryptoError } from './errors';
import { lockVaultSession } from './lockdown';
import {
  readVaultSnapshotForBackup,
  restoreVaultFromSnapshot,
} from './keystore';
import type { BackupVaultSnapshot } from './backupFormat';
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
  try {
    const infile = new File(readableUri);
    const b64 = await infile.base64();
    return backupBase64ToBytes(b64);
  } finally {
    if (readableUri !== fileUri) {
      await FileSystem.deleteAsync(readableUri, { idempotent: true }).catch(() => {});
    }
  }
}

/** Checks the vault metadata before anything on the device is replaced, so a bad file fails early. */
function assertValidVaultSnapshot(vault: BackupVaultSnapshot): void {
  const iterations = Number(vault.pbkdf2Iterations);
  if (
    !Number.isInteger(iterations) ||
    iterations < PBKDF2_ITERATIONS_MIN ||
    iterations > PBKDF2_ITERATIONS_MAX
  ) {
    throw new VaultCryptoError('Backup has an invalid key-derivation setting.');
  }
  let salt: Uint8Array;
  let wrapped: Uint8Array;
  try {
    salt = base64ToUint8Array(vault.passwordSaltB64);
    wrapped = base64ToUint8Array(vault.wrappedDekB64);
  } catch {
    throw new VaultCryptoError('Backup vault metadata is not valid Base64.');
  }
  if (salt.length !== PASSWORD_SALT_LENGTH_BYTES) {
    throw new VaultCryptoError('Backup vault salt has the wrong length.');
  }
  if (
    wrapped.length !== 1 + GCM_NONCE_LENGTH_BYTES + DATA_KEY_LENGTH_BYTES + 16 ||
    wrapped[0] !== WRAPPED_DEK_FORMAT_V1
  ) {
    throw new VaultCryptoError('Backup vault key has an unknown format.');
  }
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
  assertValidVaultSnapshot(p.vault);
  return p;
}

/**
 * Create an encrypted `.tarcak` file in the cache directory and return its URI for sharing.
 */
export async function exportEncryptedBackup(backupPassword: string): Promise<string> {
  assertPasswordAcceptable(backupPassword);

  const db = await openMainDatabase();

  // Flush any WAL data into the main file before reading it (no-op for DELETE journal mode, which
  // reports log = checkpointed = -1). A busy or partial checkpoint would leave recent writes out.
  const checkpoint = await db.getFirstAsync<{ busy: number; log: number; checkpointed: number }>(
    'PRAGMA wal_checkpoint(FULL)'
  );
  if (checkpoint && (checkpoint.busy !== 0 || checkpoint.log !== checkpoint.checkpointed)) {
    throw new VaultCryptoError('Could not flush recent changes to the database file. Try the export again.');
  }

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

async function writeDatabaseBytesToDisk(uri: string, dbBytes: Uint8Array): Promise<void> {
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

/** The database file plus the SQLite side files that must never be paired with a different main file. */
const DATABASE_FILE_SUFFIXES = ['', '-wal', '-shm', '-journal'] as const;
const STAGED_IMPORT_SUFFIX = '.import';
const PRE_IMPORT_SUFFIX = '.pre-import';

/** Moves the current database files aside, recording each move in `moved` (even if a later one fails). */
async function moveDatabaseFilesAside(
  dbUri: string,
  moved: { from: string; to: string }[]
): Promise<void> {
  for (const suffix of DATABASE_FILE_SUFFIXES) {
    const from = `${dbUri}${suffix}`;
    const info = await FileSystem.getInfoAsync(from);
    if (!info.exists) {
      continue;
    }
    const to = `${dbUri}${PRE_IMPORT_SUFFIX}${suffix}`;
    await FileSystem.deleteAsync(to, { idempotent: true });
    await FileSystem.moveAsync({ from, to });
    moved.push({ from, to });
  }
}

/**
 * Replace local vault + database from an encrypted backup file.
 * Decrypts and validates while the session is still open, stages the new database next to the old
 * one, then swaps them. If the swap fails, the previous database and vault metadata are put back, so
 * a failed import never leaves the device without data. Locks the session; the user re-unlocks with
 * the vault password from the backup (unchanged).
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

  const dbUri = buildMainDatabaseFileUri();
  const stagedUri = `${dbUri}${STAGED_IMPORT_SUFFIX}`;
  try {
    await writeDatabaseBytesToDisk(stagedUri, dbBytes);
  } catch (e) {
    await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => {});
    throw e;
  }

  const previousVault = await readVaultSnapshotForBackup().catch(() => null);

  await lockVaultSession();

  const movedAside: { from: string; to: string }[] = [];
  try {
    await moveDatabaseFilesAside(dbUri, movedAside);
    await FileSystem.moveAsync({ from: stagedUri, to: dbUri });
    await restoreVaultFromSnapshot(payload.vault);
  } catch (e) {
    await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => {});
    for (const suffix of DATABASE_FILE_SUFFIXES) {
      await FileSystem.deleteAsync(`${dbUri}${suffix}`, { idempotent: true }).catch(() => {});
    }
    for (const m of movedAside) {
      await FileSystem.moveAsync({ from: m.to, to: m.from }).catch(() => {});
    }
    if (previousVault) {
      await restoreVaultFromSnapshot(previousVault).catch(() => {});
    }
    throw e;
  }

  for (const m of movedAside) {
    await FileSystem.deleteAsync(m.to, { idempotent: true }).catch(() => {});
  }

  if (payload.appearance) {
    await writeAppearanceCache({
      isDark: !!payload.appearance.isDark,
      colorThemeId: normalizeColorThemeId(payload.appearance.colorThemeId),
    });
  }

  await recordBackupRestored(payload.exportedAt);
}

export { BACKUP_EXTENSION, BACKUP_INCLUDES };
