/**
 * Thin wrapper around expo-secure-store for vault metadata.
 *
 * What is stored:
 * - Flag: vault exists (fast check without parsing large blobs).
 * - Salt: PBKDF2 salt (not secret; must stay stable unless you rotate the vault).
 * - PBKDF2 iteration count (decimal string) used for this vault; absent on very old installs → unlock uses `PBKDF2_ITERATIONS` from code.
 * - Wrapped DEK: AES-GCM ciphertext of the SQLCipher key, encrypted by KEK from password.
 *
 * SecureStore uses Keychain / Keystore; it protects these items from other apps and from
 * casual backup extraction, but the SQLite file still needs SQLCipher so a raw DB copy is useless.
 */

import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_KEYS } from './constants';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // User asked for password, not biometrics, as the primary gate — do not require device auth here.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function setVaultExistsFlag(value: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.vaultFlag, value, OPTIONS);
}

export async function getVaultExistsFlag(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.vaultFlag, OPTIONS);
}

export async function setPasswordSaltBase64(b64: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.passwordSalt, b64, OPTIONS);
}

export async function getPasswordSaltBase64(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.passwordSalt, OPTIONS);
}

export async function setWrappedDekBase64(b64: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.wrappedDek, b64, OPTIONS);
}

export async function getWrappedDekBase64(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.wrappedDek, OPTIONS);
}

/** PBKDF2 iteration count used when this vault was created (or last password change). */
export async function setPbkdf2IterationsStored(value: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.pbkdf2Iterations, value, OPTIONS);
}

export async function getPbkdf2IterationsStored(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.pbkdf2Iterations, OPTIONS);
}

/** Remove all vault records (development / “reset app” only — use with extreme care). */
export async function wipeVaultFromSecureStore(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.vaultFlag, OPTIONS);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.passwordSalt, OPTIONS);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.pbkdf2Iterations, OPTIONS);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.wrappedDek, OPTIONS);
}
