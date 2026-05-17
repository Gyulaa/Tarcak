/**
 * Public security API for the rest of the app.
 */

export {
  createFirstVault,
  hasVault,
  unlockWithPassword,
  changeVaultPassword,
} from './vault';

export { lockVaultSession } from './lockdown';
export { eraseAllLocalTarcakData } from './resetLocalData';
export {
  registerLockOnBackground,
  isSessionUnlocked,
  suspendVaultLockOnBackground,
  resumeVaultLockOnBackground,
  isVaultLockSuspended,
} from './session';

export { openMainDatabase, closeMainDatabase, isSqlCipherAvailableInThisBuild } from '../db/client';

export {
  VaultError,
  WrongVaultPasswordError,
  VaultAlreadyExistsError,
  WeakPasswordError,
  SessionLockedError,
  VaultCryptoError,
} from './errors';
