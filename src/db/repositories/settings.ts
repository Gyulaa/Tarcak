import { openMainDatabase } from '../client';

const KEY_DEFAULT_CURRENCY = 'default_currency';

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
  await setSetting(KEY_DEFAULT_CURRENCY, code.trim().toUpperCase());
}
