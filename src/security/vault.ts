/**
 * High-level vault lifecycle: create, unlock, change password.
 *
 * Flow:
 * 1) First launch: `createFirstVault(password)` → random DEK + salt → wrap DEK → SecureStore → session unlock.
 * 2) Later: `unlockWithPassword(password)` → unwrap DEK → session unlock → app opens SQLCipher with DEK.
 * 3) Lock: `lockVaultSession()` closes DB + clears session (see lockdown.ts).
 */

import {
  DATA_KEY_LENGTH_BYTES,
  PASSWORD_SALT_LENGTH_BYTES,
  PBKDF2_ITERATIONS,
} from './constants';
import { uint8ArrayToBase64, base64ToUint8Array } from './encoding';
import {
  VaultAlreadyExistsError,
  VaultCryptoError,
  WrongVaultPasswordError,
} from './errors';
import { deriveKekFromPassword, zeroize } from './kdf';
import {
  getPasswordSaltBase64,
  getPbkdf2IterationsStored,
  getVaultExistsFlag,
  getWrappedDekBase64,
  setPasswordSaltBase64,
  setPbkdf2IterationsStored,
  setVaultExistsFlag,
  setWrappedDekBase64,
} from './keystore';
import { assertPasswordAcceptable } from './passwordPolicy';
import { secureRandomBytes } from './random';
import { setSessionDataKey } from './session';
import { unwrapDekWithKek, wrapDekWithKek } from './wrapDek';

const VAULT_FLAG_VALUE = '1';

/**
 * Iteration count persisted with the vault (or current `PBKDF2_ITERATIONS` if missing — vaults from
 * before that key existed).
 */
async function readPbkdf2IterationsForUnlock(): Promise<number> {
  const raw = await getPbkdf2IterationsStored();
  if (raw == null || raw.trim() === '') {
    return PBKDF2_ITERATIONS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 10_000 || n > 50_000_000) {
    throw new VaultCryptoError('Stored PBKDF2 iteration count is invalid.');
  }
  return n;
}

/**
 * True if this install already has vault metadata in SecureStore.
 */
export async function hasVault(): Promise<boolean> {
  const flag = await getVaultExistsFlag();
  return flag === VAULT_FLAG_VALUE;
}

/**
 * One-time setup. Generates DEK + salt, wraps DEK with password-derived KEK, persists to SecureStore.
 */
export async function createFirstVault(password: string): Promise<void> {
  assertPasswordAcceptable(password);

  if (await hasVault()) {
    throw new VaultAlreadyExistsError();
  }

  const salt = await secureRandomBytes(PASSWORD_SALT_LENGTH_BYTES);
  const dek = await secureRandomBytes(DATA_KEY_LENGTH_BYTES);

  const kek = await deriveKekFromPassword(password, salt, PBKDF2_ITERATIONS);
  try {
    const wrapped = await wrapDekWithKek(dek, kek);
    await setPasswordSaltBase64(uint8ArrayToBase64(salt));
    await setWrappedDekBase64(wrapped);
    await setPbkdf2IterationsStored(String(PBKDF2_ITERATIONS));
    await setVaultExistsFlag(VAULT_FLAG_VALUE);
  } finally {
    zeroize(kek);
    zeroize(salt);
  }

  setSessionDataKey(dek);
  zeroize(dek);
}

/**
 * Unlock: load salt + wrapped blob, derive KEK, unwrap DEK, store in session.
 * @throws WrongVaultPasswordError on bad password or corrupt ciphertext.
 */
export async function unlockWithPassword(password: string): Promise<void> {
  if (!(await hasVault())) {
    throw new WrongVaultPasswordError('No vault configured.');
  }

  const saltB64 = await getPasswordSaltBase64();
  const wrappedB64 = await getWrappedDekBase64();
  if (!saltB64 || !wrappedB64) {
    throw new VaultCryptoError('Vault metadata is incomplete.');
  }

  let salt: Uint8Array;
  try {
    salt = base64ToUint8Array(saltB64);
  } catch {
    throw new VaultCryptoError('Stored salt is not valid Base64.');
  }
  if (salt.length !== PASSWORD_SALT_LENGTH_BYTES) {
    throw new VaultCryptoError('Stored salt has wrong length.');
  }

  const iterations = await readPbkdf2IterationsForUnlock();
  const kek = await deriveKekFromPassword(password, salt, iterations);
  zeroize(salt);

  let dek: Uint8Array;
  try {
    dek = unwrapDekWithKek(wrappedB64, kek);
  } finally {
    zeroize(kek);
  }

  setSessionDataKey(dek);
  zeroize(dek); // `setSessionDataKey` copied into session; clear local copy
}

/**
 * Re-wrap the same DEK with a new password. Requires the current password to prove ownership.
 * Rotates PBKDF2 salt so offline cracking effort does not reuse the same salt forever.
 * Session remains valid if already unlocked (DEK bytes unchanged).
 */
export async function changeVaultPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  assertPasswordAcceptable(newPassword);

  if (!(await hasVault())) {
    throw new WrongVaultPasswordError('No vault configured.');
  }

  const oldSaltB64 = await getPasswordSaltBase64();
  const wrappedB64 = await getWrappedDekBase64();
  if (!oldSaltB64 || !wrappedB64) {
    throw new VaultCryptoError('Vault metadata is incomplete.');
  }

  const oldSalt = base64ToUint8Array(oldSaltB64);
  if (oldSalt.length !== PASSWORD_SALT_LENGTH_BYTES) {
    zeroize(oldSalt);
    throw new VaultCryptoError('Stored salt has wrong length.');
  }

  const iterations = await readPbkdf2IterationsForUnlock();
  const oldKek = await deriveKekFromPassword(currentPassword, oldSalt, iterations);
  let dek: Uint8Array;
  try {
    dek = unwrapDekWithKek(wrappedB64, oldKek);
  } catch (e) {
    zeroize(oldSalt);
    throw e;
  } finally {
    zeroize(oldKek);
  }

  const newSalt = await secureRandomBytes(PASSWORD_SALT_LENGTH_BYTES);
  const newKek = await deriveKekFromPassword(newPassword, newSalt, PBKDF2_ITERATIONS);
  try {
    const newWrapped = await wrapDekWithKek(dek, newKek);
    await setPasswordSaltBase64(uint8ArrayToBase64(newSalt));
    await setWrappedDekBase64(newWrapped);
    await setPbkdf2IterationsStored(String(PBKDF2_ITERATIONS));
  } finally {
    zeroize(newKek);
    zeroize(newSalt);
    zeroize(dek);
  }
}
