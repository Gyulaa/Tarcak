import * as Crypto from 'expo-crypto';

import type { AssetType } from '../../domain/types';
import { openMainDatabase } from '../client';

const CODE_PATTERN = /^[A-Z0-9]{1,12}$/;

type AssetTypeRow = {
  id: string;
  code: string;
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
};

function mapRow(r: AssetTypeRow): AssetType {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    sort_index: r.sort_index,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function normalizeAssetCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateAssetCodeFormat(code: string): void {
  const c = normalizeAssetCode(code);
  if (!CODE_PATTERN.test(c)) {
    throw new Error('Use 1–12 letters or digits (e.g. HUF, USD, XMR).');
  }
}

export async function currencyExists(code: string): Promise<boolean> {
  const db = await openMainDatabase();
  const c = normalizeAssetCode(code);
  const r = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM asset_types WHERE code = ?`,
    [c]
  );
  return !!r;
}

export async function requireRegisteredAssetCurrency(code: string): Promise<void> {
  const c = normalizeAssetCode(code);
  if (!(await currencyExists(c))) {
    throw new Error(`Unknown asset type "${c}". Add it under Settings → Asset types.`);
  }
}

export async function listAssetTypes(): Promise<AssetType[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<AssetTypeRow>(
    `SELECT id, code, name, sort_index, created_at, updated_at FROM asset_types
     ORDER BY sort_index ASC, code COLLATE NOCASE ASC`
  );
  return rows.map(mapRow);
}

export async function createAssetType(params: { code: string; name: string }): Promise<AssetType> {
  const code = normalizeAssetCode(params.code);
  validateAssetCodeFormat(code);
  const name = params.name.trim();
  if (!name) {
    throw new Error('Display name is required.');
  }
  const db = await openMainDatabase();
  const dup = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM asset_types WHERE code = ?`,
    [code]
  );
  if (dup) {
    throw new Error('That asset code already exists.');
  }
  const id = Crypto.randomUUID();
  const now = Date.now();
  const row = await db.getFirstAsync<{ si: number }>(
    `SELECT COALESCE(MAX(sort_index), -1) + 1 AS si FROM asset_types`
  );
  const sort_index = row?.si ?? 0;
  await db.runAsync(
    `INSERT INTO asset_types (id, code, name, sort_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, code, name, sort_index, now, now]
  );
  const created = await db.getFirstAsync<AssetTypeRow>(
    `SELECT id, code, name, sort_index, created_at, updated_at FROM asset_types WHERE id = ?`,
    [id]
  );
  if (!created) {
    throw new Error('Failed to read new asset type.');
  }
  return mapRow(created);
}

export async function updateAssetTypeName(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Display name is required.');
  }
  const db = await openMainDatabase();
  const now = Date.now();
  const res = await db.runAsync(
    `UPDATE asset_types SET name = ?, updated_at = ? WHERE id = ?`,
    [trimmed, now, id]
  );
  if (res.changes === 0) {
    throw new Error('Asset type not found.');
  }
}

export async function countTransactionsForAssetCode(code: string): Promise<number> {
  const db = await openMainDatabase();
  const c = normalizeAssetCode(code);
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions WHERE UPPER(TRIM(currency)) = ?`,
    [c]
  );
  return r?.n ?? 0;
}

export async function deleteAssetType(id: string): Promise<void> {
  const db = await openMainDatabase();
  const row = await db.getFirstAsync<{ code: string }>(
    `SELECT code FROM asset_types WHERE id = ?`,
    [id]
  );
  if (!row) {
    throw new Error('Asset type not found.');
  }
  const n = await countTransactionsForAssetCode(row.code);
  if (n > 0) {
    throw new Error('Cannot delete an asset type that is still used in transactions.');
  }
  const countRow = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM asset_types`);
  if ((countRow?.c ?? 0) <= 1) {
    throw new Error('Keep at least one asset type.');
  }
  const replacement = await db.getFirstAsync<{ code: string }>(
    `SELECT code FROM asset_types WHERE code != ? ORDER BY sort_index ASC, code COLLATE NOCASE ASC LIMIT 1`,
    [row.code]
  );
  if (replacement) {
    await db.runAsync(
      `UPDATE user_settings SET value = ? WHERE key = 'default_currency' AND UPPER(TRIM(value)) = ?`,
      [replacement.code, row.code]
    );
  }
  await db.runAsync(`DELETE FROM asset_types WHERE id = ?`, [id]);
}
