/**
 * Typed errors for vault and session flows.
 * Callers can use `instanceof` to show specific UI (wrong password vs missing vault vs crypto failure).
 */

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

/** Decryption of the wrapped DEK failed (wrong password or corrupted blob). */
export class WrongVaultPasswordError extends VaultError {
  constructor(message = 'Incorrect password or corrupted vault data.') {
    super(message);
    this.name = 'WrongVaultPasswordError';
  }
}

/** `createFirstVault` called when a vault already exists. */
export class VaultAlreadyExistsError extends VaultError {
  constructor(message = 'A vault is already configured on this device.') {
    super(message);
    this.name = 'VaultAlreadyExistsError';
  }
}

/** Password does not meet minimum policy. */
export class WeakPasswordError extends VaultError {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
  }
}

/** Tried to open the DB or read the DEK while the session is locked. */
export class SessionLockedError extends VaultError {
  constructor(message = 'Unlock the vault with your password first.') {
    super(message);
    this.name = 'SessionLockedError';
  }
}

/** Unexpected crypto or format failure (not a wrong-password guess). */
export class VaultCryptoError extends VaultError {
  constructor(message: string) {
    super(message);
    this.name = 'VaultCryptoError';
  }
}
