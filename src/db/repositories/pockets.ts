import * as Crypto from 'expo-crypto';

import type { Pocket } from '../../domain/types';
import { openMainDatabase } from '../client';

type PocketRow = {
  id: string;
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
};

function mapRow(r: PocketRow): Pocket {
  return {
    id: r.id,
    name: r.name,
    sort_index: r.sort_index,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listPockets(): Promise<Pocket[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<PocketRow>(
    `SELECT id, name, sort_index, created_at, updated_at FROM pockets
     ORDER BY sort_index ASC, name COLLATE NOCASE ASC`
  );
  return rows.map(mapRow);
}

export async function getPocket(id: string): Promise<Pocket | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<PocketRow>(
    `SELECT id, name, sort_index, created_at, updated_at FROM pockets WHERE id = ?`,
    [id]
  );
  return r ? mapRow(r) : null;
}

export async function createPocket(name: string): Promise<Pocket> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Pocket name is required.');
  }
  const db = await openMainDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const row = await db.getFirstAsync<{ si: number }>(
    `SELECT COALESCE(MAX(sort_index), -1) + 1 AS si FROM pockets`
  );
  const sort_index = row?.si ?? 0;
  await db.runAsync(
    `INSERT INTO pockets (id, name, sort_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, trimmed, sort_index, now, now]
  );
  return { id, name: trimmed, sort_index, created_at: now, updated_at: now };
}

export async function renamePocket(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Pocket name is required.');
  }
  const db = await openMainDatabase();
  const now = Date.now();
  const res = await db.runAsync(`UPDATE pockets SET name = ?, updated_at = ? WHERE id = ?`, [
    trimmed,
    now,
    id,
  ]);
  if (res.changes === 0) {
    throw new Error('Pocket not found.');
  }
}

/** Count ledger rows that reference this pocket (any role). */
export async function countTransactionsForPocket(pocketId: string): Promise<number> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM transactions
     WHERE pocket_id = ? OR from_pocket_id = ? OR to_pocket_id = ?`,
    [pocketId, pocketId, pocketId]
  );
  return r?.c ?? 0;
}

/** Deletes the pocket only if no transactions reference it. */
export async function deletePocketIfUnused(pocketId: string): Promise<boolean> {
  const n = await countTransactionsForPocket(pocketId);
  if (n > 0) {
    return false;
  }
  const db = await openMainDatabase();
  await db.runAsync(`DELETE FROM pockets WHERE id = ?`, [pocketId]);
  return true;
}
