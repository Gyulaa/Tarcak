/**
 * Domain types for pockets and the unified ledger (mirror SQLite, no ORM).
 */

export type TransactionKind = 'income' | 'expense' | 'transfer';

export type Pocket = {
  id: string;
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
};

/** User-defined asset / currency code (e.g. HUF, USD, XMR) with a display label. */
export type AssetType = {
  id: string;
  /** Uppercase code stored on `transactions.currency`. */
  code: string;
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
};

/** One row in `transactions` — balances are derived from these rows. */
export type LedgerTransaction = {
  id: string;
  kind: TransactionKind;
  title: string;
  /** Integer: 10^-8 of one major unit; income/expense may be negative; transfers are positive. */
  amount_minor: number;
  currency: string;
  occurred_at: number;
  created_at: number;
  updated_at: number;
  pocket_id: string | null;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
};

export type BalanceRow = {
  currency: string;
  /** Sum of signed minor deltas (same scale as `amount_minor`). */
  balance_minor: number;
};
