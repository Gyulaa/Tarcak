import { openMainDatabase } from '../client';
import * as assetTypesRepo from './assetTypes';
import * as pocketsRepo from './pockets';

const KEY_DEFAULT_CURRENCY = 'default_currency';
const KEY_JAR_ENABLED = 'jar_enabled';
const KEY_ADVANCED_JAR = 'advanced_jar_enabled';

export async function getSetting(key: string): Promise<string | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_settings WHERE key = ?`,
    [key]
  );
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await openMainDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}

export async function getDefaultCurrency(): Promise<string> {
  const v = await getSetting(KEY_DEFAULT_CURRENCY);
  return v?.trim() || 'HUF';
}

export async function setDefaultCurrency(code: string): Promise<void> {
  const c = code.trim().toUpperCase();
  const exists = await assetTypesRepo.currencyExists(c);
  if (!exists) {
    throw new Error(`Add "${c}" as an asset type before setting it as default.`);
  }
  await setSetting(KEY_DEFAULT_CURRENCY, c);
}

/** When false, Jar pool UI is hidden and the Jar pocket is archived. Default on. */
export async function getJarEnabled(): Promise<boolean> {
  const v = await getSetting(KEY_JAR_ENABLED);
  if (v == null || v.trim() === '') {
    return true;
  }
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}

export async function setJarEnabled(enabled: boolean): Promise<void> {
  await setSetting(KEY_JAR_ENABLED, enabled ? '1' : '0');
  await pocketsRepo.setJarPocketArchived(!enabled);
}

/** Per-asset milestone-based Jar distribution. Default off. */
export async function getAdvancedJarEnabled(): Promise<boolean> {
  const v = await getSetting(KEY_ADVANCED_JAR);
  if (v == null || v.trim() === '') {
    return false;
  }
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}

export async function setAdvancedJarEnabled(enabled: boolean): Promise<void> {
  await setSetting(KEY_ADVANCED_JAR, enabled ? '1' : '0');
}
