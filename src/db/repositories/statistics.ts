/**
 * Time-series and allocation stats derived from the ledger (read-only).
 */

import { openMainDatabase } from '../client';

export type StatisticsScope =
  | { mode: 'all' }
  | { mode: 'pocket'; pocketId: string }
  | { mode: 'exclude_jar'; jarId: string };

/** Restricts balance/mix queries to one category's income+expense rows (transfers never have a category). */
export type CategoryFilter =
  | { mode: 'all' }
  | { mode: 'uncategorized' }
  | { mode: 'one'; categoryId: string };

const ALL_CATEGORY_FILTER: CategoryFilter = { mode: 'all' };

/** `kind` restriction is required alongside the category predicate: transfers always have a NULL
 *  category_id, so without it an "Uncategorized" filter would also sweep in every transfer. */
function categoryFilterSql(filter: CategoryFilter): { sql: string; params: string[] } {
  if (filter.mode === 'uncategorized') {
    return { sql: `AND kind IN ('income', 'expense') AND category_id IS NULL`, params: [] };
  }
  if (filter.mode === 'one') {
    return { sql: `AND kind IN ('income', 'expense') AND category_id = ?`, params: [filter.categoryId] };
  }
  return { sql: '', params: [] };
}

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
  beforeMs: number,
  categoryFilter: CategoryFilter = ALL_CATEGORY_FILTER
): Promise<number> {
  const db = await openMainDatabase();
  const cat = categoryFilterSql(categoryFilter);
  if (scope.mode === 'all') {
    const r = await db.getFirstAsync<{ b: number }>(
      `SELECT COALESCE(SUM(
        CASE kind
          WHEN 'income' THEN amount_minor
          WHEN 'expense' THEN -amount_minor
          ELSE 0
        END
      ), 0) AS b
      FROM transactions WHERE currency = ? AND occurred_at < ? ${cat.sql}`,
      [currency, beforeMs, ...cat.params]
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
      FROM transactions WHERE currency = ? AND occurred_at < ? ${cat.sql}`,
      [p, p, p, p, currency, beforeMs, ...cat.params]
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
    FROM transactions WHERE currency = ? AND occurred_at < ? ${cat.sql}`,
    [j, j, j, j, currency, beforeMs, ...cat.params]
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
  endMs: number,
  categoryFilter: CategoryFilter = ALL_CATEGORY_FILTER
): Promise<BalanceTimelinePoint[]> {
  const db = await openMainDatabase();
  const cat = categoryFilterSql(categoryFilter);
  const rows = await db.getAllAsync<TxRow>(
    `SELECT kind, amount_minor, occurred_at, pocket_id, from_pocket_id, to_pocket_id
     FROM transactions
     WHERE currency = ? AND occurred_at >= ? AND occurred_at <= ? ${cat.sql}
     ORDER BY occurred_at ASC, id ASC`,
    [currency, startMs, endMs, ...cat.params]
  );

  let running = await baselineMinorBefore(currency, scope, startMs, categoryFilter);
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
  atMs: number,
  categoryFilter: CategoryFilter = ALL_CATEGORY_FILTER
): Promise<number> {
  const db = await openMainDatabase();
  const cat = categoryFilterSql(categoryFilter);
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
    FROM transactions WHERE currency = ? AND occurred_at <= ? ${cat.sql}`,
    [pocketId, pocketId, pocketId, pocketId, currency, atMs, ...cat.params]
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
 * With a category filter active, "balance" becomes "net signed total of that category's income/expense
 * transactions routed through this pocket" — transfers never carry a category, so they drop out entirely.
 */
export async function getPocketSlicesAt(
  currency: string,
  atMs: number,
  options: { jarId: string | null; excludeJar: boolean },
  categoryFilter: CategoryFilter = ALL_CATEGORY_FILTER
): Promise<PocketSlice[]> {
  const db = await openMainDatabase();
  const prows = await db.getAllAsync<{ id: string; name: string; is_jar: number; archived: number }>(
    `SELECT id, name, is_jar, archived FROM pockets ORDER BY is_jar DESC, sort_index ASC, name COLLATE NOCASE ASC`
  );

  const slices: PocketSlice[] = [];
  for (const p of prows) {
    if (p.archived === 1) continue;
    if (options.excludeJar && options.jarId && p.id === options.jarId) continue;
    const bal = await balanceMinorForPocketAt(p.id, currency, atMs, categoryFilter);
    if (bal === 0) continue;
    slices.push({ pocketId: p.id, name: p.name, balance_minor: bal });
  }
  return slices;
}

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string | null;
  total_minor: number;
};

/**
 * Income and expense totals by category for `currency` within [startMs, endMs] for the given scope.
 * Transfers are excluded (they never carry a category). Unlike `getPocketSlicesAt`, this is a period
 * sum, not a point-in-time balance — "how much did category X earn/cost in this range" is the natural
 * question for categories, whereas pockets need a balance snapshot because their totals persist.
 */
export async function getCategorySlices(
  currency: string,
  scope: StatisticsScope,
  startMs: number,
  endMs: number
): Promise<{ income: CategorySlice[]; expense: CategorySlice[] }> {
  const db = await openMainDatabase();
  let scopeSql = '';
  let scopeParams: string[] = [];
  if (scope.mode === 'pocket') {
    scopeSql = 'AND t.pocket_id = ?';
    scopeParams = [scope.pocketId];
  } else if (scope.mode === 'exclude_jar') {
    scopeSql = 'AND t.pocket_id != ?';
    scopeParams = [scope.jarId];
  }
  const rows = await db.getAllAsync<{
    category_id: string | null;
    category_name: string | null;
    category_color: string | null;
    kind: string;
    total_minor: number;
  }>(
    `SELECT t.category_id AS category_id, c.name AS category_name, c.color AS category_color,
            t.kind AS kind, SUM(t.amount_minor) AS total_minor
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.currency = ? AND t.occurred_at >= ? AND t.occurred_at <= ?
       AND t.kind IN ('income', 'expense') ${scopeSql}
     GROUP BY t.category_id, t.kind
     HAVING SUM(t.amount_minor) > 0
     ORDER BY total_minor DESC`,
    [currency, startMs, endMs, ...scopeParams]
  );

  const income: CategorySlice[] = [];
  const expense: CategorySlice[] = [];
  for (const r of rows) {
    const slice: CategorySlice = {
      categoryId: r.category_id,
      name: r.category_name ?? 'Uncategorized',
      color: r.category_color,
      total_minor: r.total_minor,
    };
    (r.kind === 'income' ? income : expense).push(slice);
  }
  return { income, expense };
}

export async function getEarliestOccurredAt(): Promise<number | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<{ m: number }>(
    `SELECT MIN(occurred_at) AS m FROM transactions`
  );
  if (r?.m == null) return null;
  return r.m;
}
