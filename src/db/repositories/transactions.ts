import * as Crypto from 'expo-crypto';

import type { BalanceRow, LedgerTransaction, TransactionKind } from '../../domain/types';
import { openMainDatabase } from '../client';
import * as assetTypesRepo from './assetTypes';

type TxRow = {
  id: string;
  kind: string;
  title: string;
  amount_minor: number;
  currency: string;
  occurred_at: number;
  created_at: number;
  updated_at: number;
  pocket_id: string | null;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
};

function mapRow(r: TxRow): LedgerTransaction {
  return {
    id: r.id,
    kind: r.kind as TransactionKind,
    title: r.title,
    amount_minor: r.amount_minor,
    currency: r.currency,
    occurred_at: r.occurred_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    pocket_id: r.pocket_id,
    from_pocket_id: r.from_pocket_id,
    to_pocket_id: r.to_pocket_id,
  };
}

/** Enforces the same invariants as the SQLite CHECK (plus integer amount). */
export function validateLedgerShape(t: {
  kind: TransactionKind;
  pocket_id: string | null;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
  amount_minor: number;
}): void {
  if (!Number.isInteger(t.amount_minor) || t.amount_minor === 0) {
    throw new Error('Amount must be a non-zero integer (minor units).');
  }
  if (t.kind === 'transfer' && t.amount_minor <= 0) {
    throw new Error('Transfer amount must be positive.');
  }
  if (t.kind === 'income') {
    if (!t.pocket_id || t.from_pocket_id || t.to_pocket_id) {
      throw new Error('Income requires exactly one target pocket.');
    }
  } else if (t.kind === 'expense') {
    if (!t.pocket_id || t.from_pocket_id || t.to_pocket_id) {
      throw new Error('Expense requires exactly one source pocket.');
    }
  } else {
    if (t.pocket_id || !t.from_pocket_id || !t.to_pocket_id) {
      throw new Error('Transfer requires from and to pockets.');
    }
    if (t.from_pocket_id === t.to_pocket_id) {
      throw new Error('Cannot transfer to the same pocket.');
    }
  }
}

const SELECT_LIST = `SELECT id, kind, title, amount_minor, currency, occurred_at, created_at, updated_at,
  pocket_id, from_pocket_id, to_pocket_id FROM transactions`;

export async function getTransaction(id: string): Promise<LedgerTransaction | null> {
  const db = await openMainDatabase();
  const r = await db.getFirstAsync<TxRow>(`${SELECT_LIST} WHERE id = ?`, [id]);
  return r ? mapRow(r) : null;
}

export async function insertIncome(params: {
  title: string;
  amount_minor: number;
  currency: string;
  occurred_at: number;
  pocket_id: string;
}): Promise<LedgerTransaction> {
  validateLedgerShape({
    kind: 'income',
    pocket_id: params.pocket_id,
    from_pocket_id: null,
    to_pocket_id: null,
    amount_minor: params.amount_minor,
  });
  const db = await openMainDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const title = params.title.trim();
  if (!title) {
    throw new Error('Title is required.');
  }
  const currency = params.currency.trim().toUpperCase();
  await assetTypesRepo.requireRegisteredAssetCurrency(currency);
  await db.runAsync(
    `INSERT INTO transactions (
      id, kind, title, amount_minor, currency, occurred_at, created_at, updated_at,
      pocket_id, from_pocket_id, to_pocket_id
    ) VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    [
      id,
      title,
      params.amount_minor,
      currency,
      params.occurred_at,
      now,
      now,
      params.pocket_id,
    ]
  );
  const created = await getTransaction(id);
  if (!created) {
    throw new Error('Failed to read inserted income.');
  }
  return created;
}

export async function insertExpense(params: {
  title: string;
  amount_minor: number;
  currency: string;
  occurred_at: number;
  pocket_id: string;
}): Promise<LedgerTransaction> {
  validateLedgerShape({
    kind: 'expense',
    pocket_id: params.pocket_id,
    from_pocket_id: null,
    to_pocket_id: null,
    amount_minor: params.amount_minor,
  });
  const db = await openMainDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const title = params.title.trim();
  if (!title) {
    throw new Error('Title is required.');
  }
  const currency = params.currency.trim().toUpperCase();
  await assetTypesRepo.requireRegisteredAssetCurrency(currency);
  await db.runAsync(
    `INSERT INTO transactions (
      id, kind, title, amount_minor, currency, occurred_at, created_at, updated_at,
      pocket_id, from_pocket_id, to_pocket_id
    ) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    [
      id,
      title,
      params.amount_minor,
      currency,
      params.occurred_at,
      now,
      now,
      params.pocket_id,
    ]
  );
  const created = await getTransaction(id);
  if (!created) {
    throw new Error('Failed to read inserted expense.');
  }
  return created;
}

export async function insertTransfer(params: {
  title: string;
  amount_minor: number;
  currency: string;
  occurred_at: number;
  from_pocket_id: string;
  to_pocket_id: string;
}): Promise<LedgerTransaction> {
  validateLedgerShape({
    kind: 'transfer',
    pocket_id: null,
    from_pocket_id: params.from_pocket_id,
    to_pocket_id: params.to_pocket_id,
    amount_minor: params.amount_minor,
  });
  const db = await openMainDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const title = params.title.trim();
  if (!title) {
    throw new Error('Title is required.');
  }
  const currency = params.currency.trim().toUpperCase();
  await assetTypesRepo.requireRegisteredAssetCurrency(currency);
  await db.runAsync(
    `INSERT INTO transactions (
      id, kind, title, amount_minor, currency, occurred_at, created_at, updated_at,
      pocket_id, from_pocket_id, to_pocket_id
    ) VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id,
      title,
      params.amount_minor,
      currency,
      params.occurred_at,
      now,
      now,
      params.from_pocket_id,
      params.to_pocket_id,
    ]
  );
  const created = await getTransaction(id);
  if (!created) {
    throw new Error('Failed to read inserted transfer.');
  }
  return created;
}

export async function updateTransaction(
  id: string,
  patch: Partial<{
    title: string;
    amount_minor: number;
    currency: string;
    occurred_at: number;
    kind: TransactionKind;
    pocket_id: string | null;
    from_pocket_id: string | null;
    to_pocket_id: string | null;
  }>
): Promise<void> {
  const existing = await getTransaction(id);
  if (!existing) {
    throw new Error('Transaction not found.');
  }
  const next: LedgerTransaction = {
    ...existing,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    currency:
      patch.currency !== undefined ? patch.currency.trim().toUpperCase() : existing.currency,
  };
  if (!next.title) {
    throw new Error('Title is required.');
  }
  await assetTypesRepo.requireRegisteredAssetCurrency(next.currency);
  validateLedgerShape({
    kind: next.kind,
    pocket_id: next.pocket_id,
    from_pocket_id: next.from_pocket_id,
    to_pocket_id: next.to_pocket_id,
    amount_minor: next.amount_minor,
  });
  const now = Date.now();
  const db = await openMainDatabase();
  await db.runAsync(
    `UPDATE transactions SET
      kind = ?, title = ?, amount_minor = ?, currency = ?, occurred_at = ?,
      updated_at = ?, pocket_id = ?, from_pocket_id = ?, to_pocket_id = ?
     WHERE id = ?`,
    [
      next.kind,
      next.title,
      next.amount_minor,
      next.currency,
      next.occurred_at,
      now,
      next.pocket_id,
      next.from_pocket_id,
      next.to_pocket_id,
      id,
    ]
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await openMainDatabase();
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function listTransactions(options: {
  pocketId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<LedgerTransaction[]> {
  const limit = options.limit ?? 200;
  const offset = options.offset ?? 0;
  const db = await openMainDatabase();
  if (options.pocketId) {
    const pid = options.pocketId;
    const rows = await db.getAllAsync<TxRow>(
      `${SELECT_LIST}
       WHERE pocket_id = ? OR from_pocket_id = ? OR to_pocket_id = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [pid, pid, pid, limit, offset]
    );
    return rows.map(mapRow);
  }
  const rows = await db.getAllAsync<TxRow>(
    `${SELECT_LIST} ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(mapRow);
}

/** All pockets combined: one row per currency. */
export async function sumBalancesAll(): Promise<BalanceRow[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<{ currency: string; balance_minor: number }>(`
SELECT currency, SUM(delta) AS balance_minor FROM (
  SELECT currency, amount_minor AS delta FROM transactions WHERE kind = 'income'
  UNION ALL
  SELECT currency, -amount_minor AS delta FROM transactions WHERE kind = 'expense'
  UNION ALL
  SELECT currency, -amount_minor AS delta FROM transactions WHERE kind = 'transfer'
  UNION ALL
  SELECT currency, amount_minor AS delta FROM transactions WHERE kind = 'transfer'
) GROUP BY currency
ORDER BY currency COLLATE NOCASE ASC
  `);
  return rows;
}

/** Single pocket: one row per currency that has a non-zero effect (may omit zero balances). */
export async function sumBalancesForPocket(pocketId: string): Promise<BalanceRow[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<{ currency: string; balance_minor: number }>(
    `
SELECT currency, SUM(delta) AS balance_minor FROM (
  SELECT currency, amount_minor AS delta FROM transactions
    WHERE kind = 'income' AND pocket_id = ?
  UNION ALL
  SELECT currency, -amount_minor AS delta FROM transactions
    WHERE kind = 'expense' AND pocket_id = ?
  UNION ALL
  SELECT currency, -amount_minor AS delta FROM transactions
    WHERE kind = 'transfer' AND from_pocket_id = ?
  UNION ALL
  SELECT currency, amount_minor AS delta FROM transactions
    WHERE kind = 'transfer' AND to_pocket_id = ?
) GROUP BY currency
HAVING SUM(delta) != 0
ORDER BY currency COLLATE NOCASE ASC
  `,
    [pocketId, pocketId, pocketId, pocketId]
  );
  return rows;
}
