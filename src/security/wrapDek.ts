/**
 * Wrap / unwrap the 256-bit DEK with AES-256-GCM using the KEK from PBKDF2.
 *
 * - AEAD: confidentiality + integrity — tampering or wrong KEK fails authentication.
 * - AAD is empty; the format version byte lives outside the GCM plaintext.
 *
 * On-disk / SecureStore layout (version 1):
 *   [0x01][12-byte nonce][ciphertext || 16-byte GCM tag]
 *   Stored as Base64 for SecureStore string API.
 */

import { gcm } from '@noble/ciphers/aes.js';

import {
  DATA_KEY_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
  WRAPPED_DEK_FORMAT_V1,
} from './constants';
import { VaultCryptoError, WrongVaultPasswordError } from './errors';
import { base64ToUint8Array, uint8ArrayToBase64 } from './encoding';
import { secureRandomBytes } from './random';

/**
 * Encrypt `dek` with `kek` (both 32 bytes). Returns Base64 blob.
 */
export async function wrapDekWithKek(dek: Uint8Array, kek: Uint8Array): Promise<string> {
  if (dek.length !== DATA_KEY_LENGTH_BYTES) {
    throw new VaultCryptoError(`DEK must be ${DATA_KEY_LENGTH_BYTES} bytes.`);
  }
  if (kek.length !== DATA_KEY_LENGTH_BYTES) {
    throw new VaultCryptoError(`KEK must be ${DATA_KEY_LENGTH_BYTES} bytes.`);
  }

  const iv = await secureRandomBytes(GCM_NONCE_LENGTH_BYTES);
  const cipher = gcm(kek, iv, new Uint8Array(0));
  const ciphertextWithTag = cipher.encrypt(dek);

  const payload = new Uint8Array(1 + iv.length + ciphertextWithTag.length);
  payload[0] = WRAPPED_DEK_FORMAT_V1;
  payload.set(iv, 1);
  payload.set(ciphertextWithTag, 1 + iv.length);

  return uint8ArrayToBase64(payload);
}

/**
 * Decrypt wrapped DEK. Wrong password → wrong KEK → GCM tag mismatch → WrongVaultPasswordError.
 */
export function unwrapDekWithKek(wrappedBase64: string, kek: Uint8Array): Uint8Array {
  if (kek.length !== DATA_KEY_LENGTH_BYTES) {
    throw new VaultCryptoError(`KEK must be ${DATA_KEY_LENGTH_BYTES} bytes.`);
  }

  let raw: Uint8Array;
  try {
    raw = base64ToUint8Array(wrappedBase64);
  } catch {
    throw new VaultCryptoError('Wrapped DEK is not valid Base64.');
  }

  if (raw.length < 1 + GCM_NONCE_LENGTH_BYTES + 16) {
    throw new VaultCryptoError('Wrapped DEK blob is too short.');
  }

  if (raw[0] !== WRAPPED_DEK_FORMAT_V1) {
    throw new VaultCryptoError(`Unknown wrapped DEK format: ${raw[0]}.`);
  }

  const nonce = raw.subarray(1, 1 + GCM_NONCE_LENGTH_BYTES);
  const sealed = raw.subarray(1 + GCM_NONCE_LENGTH_BYTES);

  try {
    const cipher = gcm(kek, nonce, new Uint8Array(0));
    const dek = cipher.decrypt(sealed);
    if (dek.length !== DATA_KEY_LENGTH_BYTES) {
      throw new VaultCryptoError('Unwrapped DEK has unexpected length.');
    }
    return dek;
  } catch {
    // GCM rejects wrong key / tampering — treat as bad password for UX.
    throw new WrongVaultPasswordError();
  }
}
