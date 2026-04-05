/**
 * Time-series and allocation stats derived from the ledger (read-only).
 */

import { openMainDatabase } from '../client';

export type StatisticsScope =
  | { mode: 'all' }
  | { mode: 'pocket'; pocketId: string }
  | { mode: 'exclude_jar'; jarId: string };

export type BalanceTimelinePoint = {
  /** Unix ms */
  at: number;
  balance_minor: number;
};

type TxRow = {
  kind: string;
  amount_minor: number;
  occurred_at: number;
  pocket_id: string | null;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
};

function deltaForScope(row: TxRow, scope: StatisticsScope): number {
  if (scope.mode === 'all') {
    if (row.kind === 'income') return row.amount_minor;
    if (row.kind === 'expense') return -row.amount_minor;
    return 0;
  }
  if (scope.mode === 'pocket') {
    const p = scope.pocketId;
    if (row.kind === 'income' && row.pocket_id === p) return row.amount_minor;
    if (row.kind === 'expense' && row.pocket_id === p) return -row.amount_minor;
    if (row.kind === 'transfer') {
      let d = 0;
      if (row.from_pocket_id === p) d -= row.amount_minor;
      if (row.to_pocket_id === p) d += row.amount_minor;
      return d;
    }
    return 0;
  }
  const j = scope.jarId;
  if (row.kind === 'income' && row.pocket_id && row.pocket_id !== j) return row.amount_minor;
  if (row.kind === 'expense' && row.pocket_id && row.pocket_id !== j) return -row.amount_minor;
  if (row.kind === 'transfer') {
    let d = 0;
    if (row.from_pocket_id !== j) d -= row.amount_minor;
    if (row.to_pocket_id !== j) d += row.amount_minor;
    return d;
  }
  return 0;
}

async function baselineMinorBefore(
  currency: string,
  scope: StatisticsScope,
  beforeMs: number
): Promise<number> {
  const db = await openMainDatabase();
  if (scope.mode === 'all') {
    const r = await db.getFirstAsync<{ b: number }>(
      `SELECT COALESCE(SUM(
        CASE kind
          WHEN 'income' THEN amount_minor
          WHEN 'expense' THEN -amount_minor
          ELSE 0
        END
      ), 0) AS b
      FROM transactions WHERE currency = ? AND occurred_at < ?`,
      [currency, beforeMs]
    );
    return r?.b ?? 0;
  }
  if (scope.mode === 'pocket') {
    const p = scope.pocketId;
    const r = await db.getFirstAsync<{ b: number }>(
      `SELECT COALESCE(SUM(
        CASE
          WHEN kind = 'income' AND pocket_id = ? THEN amount_minor
          WHEN kind = 'expense' AND pocket_id = ? THEN -amount_minor
          WHEN kind = 'transfer' AND from_pocket_id = ? THEN -amount_minor
          WHEN kind = 'transfer' AND to_pocket_id = ? THEN amount_minor
          ELSE 0
        END
      ), 0) AS b
      FROM transactions WHERE currency = ? AND occurred_at < ?`,
      [p, p, p, p, currency, beforeMs]
    );
    return r?.b ?? 0;
  }
  const j = scope.jarId;
  const r = await db.getFirstAsync<{ b: number }>(
    `SELECT COALESCE(SUM(
      CASE
        WHEN kind = 'income' AND pocket_id IS NOT NULL AND pocket_id != ? THEN amount_minor
        WHEN kind = 'expense' AND pocket_id IS NOT NULL AND pocket_id != ? THEN -amount_minor
        WHEN kind = 'transfer' AND from_pocket_id != ? THEN -amount_minor
        WHEN kind = 'transfer' AND to_pocket_id != ? THEN amount_minor
        ELSE 0
      END
    ), 0) AS b
    FROM transactions WHERE currency = ? AND occurred_at < ?`,
    [j, j, j, j, currency, beforeMs]
  );
  return r?.b ?? 0;
}

/**
 * Running balance for `currency` within [startMs, endMs] for the given scope.
 * Points include the balance at startMs (before any tx exactly at startMs, baseline uses occurred_at < startMs),
 * then after each relevant transaction, and a final point at endMs if needed.
 */
export async function getBalanceTimeline(
  currency: string,
  scope: StatisticsScope,
  startMs: number,
  endMs: number
): Promise<BalanceTimelinePoint[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<TxRow>(
    `SELECT kind, amount_minor, occurred_at, pocket_id, from_pocket_id, to_pocket_id
     FROM transactions
     WHERE currency = ? AND occurred_at >= ? AND occurred_at <= ?
     ORDER BY occurred_at ASC, id ASC`,
    [currency, startMs, endMs]
  );

  let running = await baselineMinorBefore(currency, scope, startMs);
  const points: BalanceTimelinePoint[] = [{ at: startMs, balance_minor: running }];

  for (const row of rows) {
    const d = deltaForScope(row, scope);
    if (d === 0) continue;
    running += d;
    const last = points[points.length - 1];
    if (last.at === row.occurred_at) {
      last.balance_minor = running;
    } else {
      points.push({ at: row.occurred_at, balance_minor: running });
    }
  }

  const lastPt = points[points.length - 1];
  if (lastPt.at < endMs) {
    points.push({ at: endMs, balance_minor: running });
  }

  return points;
}

export function downsampleTimeline(
  points: BalanceTimelinePoint[],
  maxPoints: number
): BalanceTimelinePoint[] {
  if (points.length <= maxPoints) return points;
  const out: BalanceTimelinePoint[] = [];
  const n = points.length;
  const step = (n - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? n - 1 : Math.round(i * step);
    out.push(points[Math.min(idx, n - 1)]);
  }
  const deduped: BalanceTimelinePoint[] = [];
  for (const p of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.at === p.at && prev.balance_minor === p.balance_minor) continue;
    deduped.push(p);
  }
  return deduped.length >= 2 ? deduped : out;
}

async function balanceMinorForPocketAt(
  pocketId: string,
  currency: string,
  atMs: number
): Promise<number> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<{ b: number }>(
    `SELECT COALESCE(SUM(
      CASE
        WHEN kind = 'income' AND pocket_id = ? THEN amount_minor
        WHEN kind = 'expense' AND pocket_id = ? THEN -amount_minor
        WHEN kind = 'transfer' AND from_pocket_id = ? THEN -amount_minor
        WHEN kind = 'transfer' AND to_pocket_id = ? THEN amount_minor
        ELSE 0
      END
    ), 0) AS b
    FROM transactions WHERE currency = ? AND occurred_at <= ?`,
    [pocketId, pocketId, pocketId, pocketId, currency, atMs]
  );
  return r?.b ?? 0;
}

export type PocketSlice = {
  pocketId: string;
  name: string;
  balance_minor: number;
};

/**
 * Non-zero pocket balances for one currency at `atMs` (for donut). Excludes archived pockets if not passed.
 */
export async function getPocketSlicesAt(
  currency: string,
  atMs: number,
  options: { jarId: string | null; excludeJar: boolean }
): Promise<PocketSlice[]> {
  const db = await openMainDatabase();
  const prows = await db.getAllAsync<{ id: string; name: string; is_jar: number; archived: number }>(
    `SELECT id, name, is_jar, archived FROM pockets ORDER BY is_jar DESC, sort_index ASC, name COLLATE NOCASE ASC`
  );

  const slices: PocketSlice[] = [];
  for (const p of prows) {
    if (p.archived === 1) continue;
    if (options.excludeJar && options.jarId && p.id === options.jarId) continue;
    const bal = await balanceMinorForPocketAt(p.id, currency, atMs);
    if (bal === 0) continue;
    slices.push({ pocketId: p.id, name: p.name, balance_minor: bal });
  }
  return slices;
}

export async function getEarliestOccurredAt(): Promise<number | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<{ m: number }>(
    `SELECT MIN(occurred_at) AS m FROM transactions`
  );
  if (r?.m == null) return null;
  return r.m;
}
