import * as Crypto from 'expo-crypto';

import type { Pocket } from '../../domain/types';
import { openMainDatabase } from '../client';

type PocketRow = {
  id: string;
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
  is_jar: number;
  archived: number;
};

function mapRow(r: PocketRow): Pocket {
  return {
    id: r.id,
    name: r.name,
    sort_index: r.sort_index,
    created_at: r.created_at,
    updated_at: r.updated_at,
    is_jar: r.is_jar === 1,
    archived: r.archived === 1,
  };
}

/** Active pockets only (excludes archived). Used for lists and transaction pickers. */
export async function listPockets(): Promise<Pocket[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<PocketRow>(
    `SELECT id, name, sort_index, created_at, updated_at, is_jar, archived FROM pockets
     WHERE archived = 0
     ORDER BY is_jar DESC, sort_index ASC, name COLLATE NOCASE ASC`
  );
  return rows.map(mapRow);
}

/** Pockets shown in the main list (excludes the system Jar). */
export async function listRegularPockets(): Promise<Pocket[]> {
  const all = await listPockets();
  return all.filter((p) => !p.is_jar);
}

/** By id, including archived rows (e.g. pocket detail opened from history). */
export async function getPocket(id: string): Promise<Pocket | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<PocketRow>(
    `SELECT id, name, sort_index, created_at, updated_at, is_jar, archived FROM pockets WHERE id = ?`,
    [id]
  );
  return r ? mapRow(r) : null;
}

/** The system Jar row, even when archived (needed to unarchive when re-enabling the feature). */
export async function getJarPocket(): Promise<Pocket | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<PocketRow>(
    `SELECT id, name, sort_index, created_at, updated_at, is_jar, archived FROM pockets WHERE is_jar = 1 LIMIT 1`
  );
  return r ? mapRow(r) : null;
}

/** When Jar pool is disabled, archive the Jar; when enabled, restore it. */
export async function setJarPocketArchived(archived: boolean): Promise<void> {
  const db = await openMainDatabase();
  const now = Date.now();
  await db.runAsync(`UPDATE pockets SET archived = ?, updated_at = ? WHERE is_jar = 1`, [
    archived ? 1 : 0,
    now,
  ]);
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
    `SELECT COALESCE(MAX(sort_index), -1) + 1 AS si FROM pockets WHERE is_jar = 0 AND archived = 0`
  );
  const sort_index = row?.si ?? 0;
  await db.runAsync(
    `INSERT INTO pockets (id, name, sort_index, created_at, updated_at, is_jar, archived)
     VALUES (?, ?, ?, ?, ?, 0, 0)`,
    [id, trimmed, sort_index, now, now]
  );
  return {
    id,
    name: trimmed,
    sort_index,
    created_at: now,
    updated_at: now,
    is_jar: false,
    archived: false,
  };
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

/** Deletes the pocket only if no transactions reference it. The Jar cannot be deleted. */
export async function deletePocketIfUnused(pocketId: string): Promise<boolean> {
  const p = await getPocket(pocketId);
  if (!p || p.is_jar) {
    return false;
  }
  const n = await countTransactionsForPocket(pocketId);
  if (n > 0) {
    return false;
  }
  const db = await openMainDatabase();
  await db.runAsync(`DELETE FROM pockets WHERE id = ?`, [pocketId]);
  return true;
}
