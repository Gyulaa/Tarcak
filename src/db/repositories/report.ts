/**
 * Grouped income/expense sums for the monthly report export (read-only). The month bounds come from
 * JS (`monthRangeFor`), so no SQL time-zone handling is needed.
 */

import type { ReportMonth, ReportRow } from '../../domain/monthlyReport';
import { openMainDatabase } from '../client';
import { scopeSql, type StatisticsScope } from './statistics';

/**
 * One row per month, currency, kind and category, with the plain sum of `amount_minor` (transfers never
 * count). `currencies` left out means every currency; the export screen lists the currencies from these
 * rows and the CSV builder drops the ones the user unticks.
 */
export async function getReportRows(params: {
  months: ReportMonth[];
  scope: StatisticsScope;
  currencies?: string[];
}): Promise<ReportRow[]> {
  const { months, scope, currencies } = params;
  if (currencies && currencies.length === 0) return [];
  const db = await openMainDatabase();
  const scoped = scopeSql(scope);
  const currencySql = currencies ? `AND t.currency IN (${currencies.map(() => '?').join(', ')})` : '';

  const out: ReportRow[] = [];
  for (const month of months) {
    // Sums come back as text: the driver's JS numbers are exact only up to 2^53.
    const rows = await db.getAllAsync<{
      currency: string;
      kind: 'income' | 'expense';
      category_name: string | null;
      total: string;
    }>(
      `SELECT t.currency AS currency, t.kind AS kind, c.name AS category_name,
              CAST(SUM(t.amount_minor) AS TEXT) AS total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ?
         AND t.kind IN ('income', 'expense') ${currencySql} ${scoped.sql}
       GROUP BY t.currency, t.kind, t.category_id`,
      [month.fromMs, month.toMs, ...(currencies ?? []), ...scoped.params]
    );
    for (const r of rows) {
      out.push({
        month: month.key,
        currency: r.currency,
        kind: r.kind,
        category: r.category_name,
        total: BigInt(r.total),
      });
    }
  }
  return out;
}
