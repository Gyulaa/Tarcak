import { createContext, useContext } from 'react';

/**
 * Lets any screen call the same lock handler provided by the vault gate (closes DB + clears DEK).
 */
export const LockVaultContext = createContext<() => Promise<void>>(async () => {});

export function useLockVault(): () => Promise<void> {
  return useContext(LockVaultContext);
}
