import type { LedgerTransaction } from '../domain/types';
import { formatMinorForDisplay } from './formatMinor';

/**
 * The signed effect on a balance: expenses are stored positive, the row shows them negative. A
 * transfer has no sign unless it is seen from one of its pockets.
 */
export function transactionAmountText(item: LedgerTransaction, pocketId?: string): string {
  const seen = pocketId !== undefined && item.from_pocket_id !== item.to_pocket_id;
  const out = item.kind === 'expense' || (item.kind === 'transfer' && seen && item.from_pocket_id === pocketId);
  const into = item.kind === 'income' || (item.kind === 'transfer' && seen && item.to_pocket_id === pocketId);
  const delta = out ? -item.amount_minor : item.amount_minor;
  return (into && delta > 0 ? '+' : '') + formatMinorForDisplay(delta, item.currency);
}
