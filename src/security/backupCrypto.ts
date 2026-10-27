/**
 * Outer encryption for portable `.tarcak` backup files.
 *
 * File layout, format 2 (written now):
 *   [6 bytes ASCII magic "TRCAK1"]
 *   [1 byte format 0x02]
 *   [4-byte big-endian PBKDF2 iteration count]
 *   [16-byte PBKDF2 salt]
 *   [12-byte GCM nonce]
 *   [AES-256-GCM ciphertext + tag]  ← UTF-8 JSON payload; the header above is the GCM AAD
 *
 * Key = PBKDF2-HMAC-SHA256(backup password, salt, iterations from the header). Storing the count
 * lets `PBKDF2_ITERATIONS` rise without breaking files written earlier.
 *
 * Format 1 (still read): same without the iteration count, empty AAD, and always 100 000 iterations.
 */

import { gcm } from '@noble/ciphers/aes.js';

import {
  GCM_NONCE_LENGTH_BYTES,
  PASSWORD_SALT_LENGTH_BYTES,
  PBKDF2_ITERATIONS,
  PBKDF2_ITERATIONS_MAX,
  PBKDF2_ITERATIONS_MIN,
} from './constants';
import { uint8ArrayToBase64, base64ToUint8Array } from './encoding';
import { VaultCryptoError, WrongVaultPasswordError } from './errors';
import { deriveKekFromPassword, zeroize } from './kdf';
import { assertPasswordAcceptable } from './passwordPolicy';
import { secureRandomBytes } from './random';

export const BACKUP_FILE_MAGIC = new TextEncoder().encode('TRCAK1');
export const BACKUP_OUTER_FORMAT_V1 = 0x01;
export const BACKUP_OUTER_FORMAT_V2 = 0x02;

/** Format 1 files carry no iteration count; this is the value they were all written with. */
const BACKUP_V1_PBKDF2_ITERATIONS = 100_000;

const MAGIC_LEN = BACKUP_FILE_MAGIC.length;
const ITERATIONS_LEN = 4;
const GCM_TAG_LEN = 16;

export async function encryptBackupPayloadUtf8(
  backupPassword: string,
  payloadUtf8: Uint8Array
): Promise<Uint8Array> {
  assertPasswordAcceptable(backupPassword);

  const salt = await secureRandomBytes(PASSWORD_SALT_LENGTH_BYTES);
  const nonce = await secureRandomBytes(GCM_NONCE_LENGTH_BYTES);
  const key = await deriveKekFromPassword(backupPassword, salt, PBKDF2_ITERATIONS);

  try {
    const header = new Uint8Array(MAGIC_LEN + 1 + ITERATIONS_LEN + salt.length + nonce.length);
    let o = 0;
    header.set(BACKUP_FILE_MAGIC, o);
    o += MAGIC_LEN;
    header[o++] = BACKUP_OUTER_FORMAT_V2;
    new DataView(header.buffer).setUint32(o, PBKDF2_ITERATIONS, false);
    o += ITERATIONS_LEN;
    header.set(salt, o);
    o += salt.length;
    header.set(nonce, o);

    const cipher = gcm(key, nonce, header);
    const sealed = cipher.encrypt(payloadUtf8);

    const out = new Uint8Array(header.length + sealed.length);
    out.set(header, 0);
    out.set(sealed, header.length);
    return out;
  } finally {
    zeroize(key);
    zeroize(salt);
  }
}

export async function decryptBackupPayloadUtf8(
  backupPassword: string,
  fileBytes: Uint8Array
): Promise<Uint8Array> {
  if (fileBytes.length < MAGIC_LEN + 1) {
    throw new VaultCryptoError('Backup file is too short.');
  }

  for (let i = 0; i < MAGIC_LEN; i++) {
    if (fileBytes[i] !== BACKUP_FILE_MAGIC[i]) {
      throw new VaultCryptoError('Not a Tarcak backup file.');
    }
  }

  const format = fileBytes[MAGIC_LEN];
  if (format !== BACKUP_OUTER_FORMAT_V1 && format !== BACKUP_OUTER_FORMAT_V2) {
    throw new VaultCryptoError('Unsupported backup file format. Update the app to open this backup.');
  }
  const iterationsLen = format === BACKUP_OUTER_FORMAT_V2 ? ITERATIONS_LEN : 0;
  const headerLen = MAGIC_LEN + 1 + iterationsLen + PASSWORD_SALT_LENGTH_BYTES + GCM_NONCE_LENGTH_BYTES;
  if (fileBytes.length < headerLen + GCM_TAG_LEN) {
    throw new VaultCryptoError('Backup file is too short.');
  }

  let iterations = BACKUP_V1_PBKDF2_ITERATIONS;
  if (format === BACKUP_OUTER_FORMAT_V2) {
    iterations = new DataView(fileBytes.buffer, fileBytes.byteOffset).getUint32(MAGIC_LEN + 1, false);
    if (iterations < PBKDF2_ITERATIONS_MIN || iterations > PBKDF2_ITERATIONS_MAX) {
      throw new VaultCryptoError('Backup file has an invalid key-derivation setting.');
    }
  }

  const saltStart = MAGIC_LEN + 1 + iterationsLen;
  const salt = fileBytes.subarray(saltStart, saltStart + PASSWORD_SALT_LENGTH_BYTES);
  const nonce = fileBytes.subarray(saltStart + PASSWORD_SALT_LENGTH_BYTES, headerLen);
  const sealed = fileBytes.subarray(headerLen);
  const aad = format === BACKUP_OUTER_FORMAT_V2 ? fileBytes.subarray(0, headerLen) : new Uint8Array(0);

  const key = await deriveKekFromPassword(backupPassword, salt, iterations);
  try {
    const cipher = gcm(key, nonce, aad);
    return cipher.decrypt(sealed);
  } catch {
    throw new WrongVaultPasswordError('Incorrect backup password or corrupted file.');
  } finally {
    zeroize(key);
  }
}

export function backupBytesToBase64(bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes);
}

export function backupBase64ToBytes(b64: string): Uint8Array {
  return base64ToUint8Array(b64);
}
