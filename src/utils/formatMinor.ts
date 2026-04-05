/**
 * Display helpers for amounts stored as signed integer minor units (10^-8 per major unit).
 */

import { formatMinorToAmountString } from './amountMinor';

export function formatMinorForDisplay(minor: number, currency: string): string {
  const c = currency.toUpperCase();
  return `${formatMinorToAmountString(minor)} ${c}`;
}
