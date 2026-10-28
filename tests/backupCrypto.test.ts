import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';

import { gcm } from '@noble/ciphers/aes.js';

import {
  BACKUP_FILE_MAGIC,
  decryptBackupPayloadUtf8,
  encryptBackupPayloadUtf8,
} from '../src/security/backupCrypto';
import { PBKDF2_ITERATIONS } from '../src/security/constants';
import { VaultCryptoError, WrongVaultPasswordError } from '../src/security/errors';
import { deriveKekFromPassword } from '../src/security/kdf';

const PASSWORD = 'correct horse';
const payload = new TextEncoder().encode('{"payloadVersion":1}');

/** A format 1 file exactly as earlier app versions wrote it (no iteration count, no AAD). */
async function buildV1File(password: string, plain: Uint8Array): Promise<Uint8Array> {
  const salt = new Uint8Array(randomBytes(16));
  const nonce = new Uint8Array(randomBytes(12));
  const key = await deriveKekFromPassword(password, salt, 100_000);
  const sealed = gcm(key, nonce, new Uint8Array(0)).encrypt(plain);
  return Uint8Array.from([...BACKUP_FILE_MAGIC, 0x01, ...salt, ...nonce, ...sealed]);
}

describe('backup outer encryption', () => {
  test('new files are format 2 and carry the iteration count', async () => {
    const file = await encryptBackupPayloadUtf8(PASSWORD, payload);
    assert.equal(file[BACKUP_FILE_MAGIC.length], 0x02);
    const view = new DataView(file.buffer, file.byteOffset);
    assert.equal(view.getUint32(BACKUP_FILE_MAGIC.length + 1, false), PBKDF2_ITERATIONS);
    assert.deepEqual(await decryptBackupPayloadUtf8(PASSWORD, file), payload);
  });

  test('format 1 files from earlier versions still open', async () => {
    const file = await buildV1File(PASSWORD, payload);
    assert.deepEqual(await decryptBackupPayloadUtf8(PASSWORD, file), payload);
  });

  test('a wrong password is reported as such', async () => {
    const file = await encryptBackupPayloadUtf8(PASSWORD, payload);
    await assert.rejects(decryptBackupPayloadUtf8('wrong password', file), WrongVaultPasswordError);
  });

  test('a tampered header fails authentication', async () => {
    const file = await encryptBackupPayloadUtf8(PASSWORD, payload);
    const saltByte = BACKUP_FILE_MAGIC.length + 1 + 4;
    file[saltByte] ^= 0xff;
    await assert.rejects(decryptBackupPayloadUtf8(PASSWORD, file), WrongVaultPasswordError);
  });

  test('an out-of-range iteration count is rejected before any key work', async () => {
    const file = await encryptBackupPayloadUtf8(PASSWORD, payload);
    new DataView(file.buffer, file.byteOffset).setUint32(BACKUP_FILE_MAGIC.length + 1, 0xffffffff, false);
    await assert.rejects(decryptBackupPayloadUtf8(PASSWORD, file), VaultCryptoError);
  });

  test('unknown formats and foreign files are rejected', async () => {
    const file = await encryptBackupPayloadUtf8(PASSWORD, payload);
    file[BACKUP_FILE_MAGIC.length] = 0x03;
    await assert.rejects(decryptBackupPayloadUtf8(PASSWORD, file), /Unsupported backup file format/);
    await assert.rejects(decryptBackupPayloadUtf8(PASSWORD, new Uint8Array(64)), /Not a Tarcak backup/);
    const fresh = await encryptBackupPayloadUtf8(PASSWORD, payload);
    await assert.rejects(decryptBackupPayloadUtf8(PASSWORD, fresh.subarray(0, 20)), /too short/);
  });
});
