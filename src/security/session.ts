/**
 * In-memory session: holds the plaintext DEK only while the user is “unlocked”.
 *
 * Security notes:
 * - The DEK must be cleared when the app backgrounds (see lockdown.ts) so a lost device
 *   with a locked screen does not keep the DB key in RAM indefinitely.
 * - JavaScript cannot guarantee the runtime zeroes freed memory; `fill(0)` is best-effort.
 */

import { AppState, type AppStateStatus } from 'react-native';

import { SessionLockedError } from './errors';

/** Holds the active DEK after successful unlock or first-time vault creation. */
let sessionDataKey: Uint8Array | null = null;

let backgroundListenerRegistered = false;

/** While > 0, AppState background/inactive does not lock (document picker, share sheet, import). */
let vaultLockSuspensionDepth = 0;

/**
 * Prevent automatic vault lock while the app is inactive (e.g. system file picker).
 * Pair every call with `resumeVaultLockOnBackground()` in `finally`.
 */
export function suspendVaultLockOnBackground(): void {
  vaultLockSuspensionDepth += 1;
}

export function resumeVaultLockOnBackground(): void {
  vaultLockSuspensionDepth = Math.max(0, vaultLockSuspensionDepth - 1);
}

export function isVaultLockSuspended(): boolean {
  return vaultLockSuspensionDepth > 0;
}

/**
 * Store a copy of the DEK for this session. Any previous session key is zeroed first.
 */
export function setSessionDataKey(dek: Uint8Array): void {
  clearSessionDataKey();
  sessionDataKey = new Uint8Array(dek);
}

/**
 * Best-effort wipe and drop the in-memory DEK (does not close SQLite — use lockVaultSession).
 */
export function clearSessionDataKey(): void {
  if (sessionDataKey) {
    sessionDataKey.fill(0);
    sessionDataKey = null;
  }
}

/**
 * Return the DEK for opening SQLCipher. Only `src/db/client.ts` should call this.
 */
export function getSessionDataKeyOrThrow(): Uint8Array {
  if (!sessionDataKey) {
    throw new SessionLockedError();
  }
  return sessionDataKey;
}

export function isSessionUnlocked(): boolean {
  return sessionDataKey !== null;
}

/**
 * Register a single AppState listener: background / inactive → lock vault session.
 * Uses dynamic import of lockdown to avoid a static import cycle with db/client.
 */
export function registerLockOnBackground(): void {
  if (backgroundListenerRegistered) {
    return;
  }
  backgroundListenerRegistered = true;

  const onChange = (next: AppStateStatus) => {
    if (vaultLockSuspensionDepth > 0) {
      return;
    }
    if (next === 'background' || next === 'inactive') {
      void import('./lockdown').then(({ lockVaultSession }) => lockVaultSession());
    }
  };

  AppState.addEventListener('change', onChange);
}
