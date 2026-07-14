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
  /** Exactly one pocket per vault; holds pooled funds before distribution. */
  is_jar: boolean;
  /** Hidden from pocket lists and transaction pickers (e.g. Jar when pool feature is off). */
  archived: boolean;
};

/** One row in `jar_distribution_rules` (basis points, sum must be 10_000 = 100%). */
export type JarDistributionRule = {
  id: string;
  target_pocket_id: string;
  target_pocket_name: string;
  percent_bps: number;
  sort_index: number;
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

/** User-defined transaction tag (e.g. Groceries, Rent). Optional on income/expense; never set on transfers. */
export type Category = {
  id: string;
  name: string;
  /** Optional hex color (#RRGGBB); falls back to a hash-based color at render time when null. */
  color: string | null;
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
  /** Unix ms when the transaction took place (shown in History). */
  occurred_at: number;
  created_at: number;
  updated_at: number;
  pocket_id: string | null;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
  category_id: string | null;
};

export type BalanceRow = {
  currency: string;
  /** Sum of signed minor deltas (same scale as `amount_minor`). */
  balance_minor: number;
};
