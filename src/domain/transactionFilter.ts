/**
 * History filters as SQL conditions, so the database filters and pages the ledger
 * instead of the screen slicing the most recent N rows.
 */

export const UNCATEGORIZED_FILTER = '__uncategorized__';

export type TransactionFilter = {
  kinds?: string[];
  currencies?: string[];
  pocketIds?: string[];
  categoryIds?: string[];
  /** Lets the `income` kind include transfers pooled into the Jar from another pocket. */
  jarPocketId?: string | null;
};

/** Values inside one dimension are ORed; the dimensions are ANDed by the caller. */
export function buildTransactionFilter(filter: TransactionFilter): {
  clauses: string[];
  params: string[];
} {
  const clauses: string[] = [];
  const params: string[] = [];

  if (filter.kinds?.length) {
    const parts: string[] = [];
    for (const kind of filter.kinds) {
      parts.push('kind = ?');
      params.push(kind);
      if (kind === 'income' && filter.jarPocketId) {
        parts.push("(kind = 'transfer' AND to_pocket_id = ? AND from_pocket_id != ?)");
        params.push(filter.jarPocketId, filter.jarPocketId);
      }
    }
    clauses.push(`(${parts.join(' OR ')})`);
  }

  if (filter.currencies?.length) {
    clauses.push(`currency IN (${filter.currencies.map(() => '?').join(', ')})`);
    params.push(...filter.currencies);
  }

  if (filter.pocketIds?.length) {
    const parts: string[] = [];
    for (const id of filter.pocketIds) {
      parts.push('pocket_id = ?', 'from_pocket_id = ?', 'to_pocket_id = ?');
      params.push(id, id, id);
    }
    clauses.push(`(${parts.join(' OR ')})`);
  }

  if (filter.categoryIds?.length) {
    const parts: string[] = [];
    for (const id of filter.categoryIds) {
      if (id === UNCATEGORIZED_FILTER) {
        parts.push('category_id IS NULL');
      } else {
        parts.push('category_id = ?');
        params.push(id);
      }
    }
    clauses.push(`(${parts.join(' OR ')})`);
  }

  return { clauses, params };
}
