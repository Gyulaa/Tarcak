/**
 * Outer encryption for portable `.tarcak` backup files.
 *
 * File layout:
 *   [6 bytes ASCII magic "TRCAK1"]
 *   [1 byte format 0x01]
 *   [16-byte PBKDF2 salt]
 *   [12-byte GCM nonce]
 *   [AES-256-GCM ciphertext + tag]  ← UTF-8 JSON payload
 *
 * Key = PBKDF2-HMAC-SHA256(backup password, salt, PBKDF2_ITERATIONS).
 */

import { gcm } from '@noble/ciphers/aes.js';

import {
  GCM_NONCE_LENGTH_BYTES,
  PASSWORD_SALT_LENGTH_BYTES,
  PBKDF2_ITERATIONS,
} from './constants';
import { uint8ArrayToBase64, base64ToUint8Array } from './encoding';
import { VaultCryptoError, WrongVaultPasswordError } from './errors';
import { deriveKekFromPassword, zeroize } from './kdf';
import { assertPasswordAcceptable } from './passwordPolicy';
import { secureRandomBytes } from './random';

export const BACKUP_FILE_MAGIC = new TextEncoder().encode('TRCAK1');
export const BACKUP_OUTER_FORMAT_V1 = 0x01;

const MAGIC_LEN = BACKUP_FILE_MAGIC.length;

export async function encryptBackupPayloadUtf8(
  backupPassword: string,
  payloadUtf8: Uint8Array
): Promise<Uint8Array> {
  assertPasswordAcceptable(backupPassword);

  const salt = await secureRandomBytes(PASSWORD_SALT_LENGTH_BYTES);
  const nonce = await secureRandomBytes(GCM_NONCE_LENGTH_BYTES);
  const key = await deriveKekFromPassword(backupPassword, salt, PBKDF2_ITERATIONS);

  try {
    const cipher = gcm(key, nonce, new Uint8Array(0));
    const sealed = cipher.encrypt(payloadUtf8);

    const out = new Uint8Array(MAGIC_LEN + 1 + salt.length + nonce.length + sealed.length);
    let o = 0;
    out.set(BACKUP_FILE_MAGIC, o);
    o += MAGIC_LEN;
    out[o++] = BACKUP_OUTER_FORMAT_V1;
    out.set(salt, o);
    o += salt.length;
    out.set(nonce, o);
    o += nonce.length;
    out.set(sealed, o);
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
  const minLen = MAGIC_LEN + 1 + PASSWORD_SALT_LENGTH_BYTES + GCM_NONCE_LENGTH_BYTES + 16;
  if (fileBytes.length < minLen) {
    throw new VaultCryptoError('Backup file is too short.');
  }

  for (let i = 0; i < MAGIC_LEN; i++) {
    if (fileBytes[i] !== BACKUP_FILE_MAGIC[i]) {
      throw new VaultCryptoError('Not a Tarcak backup file.');
    }
  }

  if (fileBytes[MAGIC_LEN] !== BACKUP_OUTER_FORMAT_V1) {
    throw new VaultCryptoError('Unsupported backup file format.');
  }

  const salt = fileBytes.subarray(MAGIC_LEN + 1, MAGIC_LEN + 1 + PASSWORD_SALT_LENGTH_BYTES);
  const nonce = fileBytes.subarray(
    MAGIC_LEN + 1 + PASSWORD_SALT_LENGTH_BYTES,
    MAGIC_LEN + 1 + PASSWORD_SALT_LENGTH_BYTES + GCM_NONCE_LENGTH_BYTES
  );
  const sealed = fileBytes.subarray(MAGIC_LEN + 1 + PASSWORD_SALT_LENGTH_BYTES + GCM_NONCE_LENGTH_BYTES);

  const key = await deriveKekFromPassword(backupPassword, salt, PBKDF2_ITERATIONS);
  try {
    const cipher = gcm(key, nonce, new Uint8Array(0));
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
