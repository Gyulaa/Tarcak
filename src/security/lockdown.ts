/**
 * Full session lock: close the database handle (releases native resources) and wipe the DEK.
 * Invoked on AppState background/inactive and can be called from UI (“Lock now”).
 */

import { closeMainDatabase } from '../db/client';
import { clearSessionDataKey } from './session';

export async function lockVaultSession(): Promise<void> {
  await closeMainDatabase();
  clearSessionDataKey();
}
