/**
 * Display helpers for amounts stored as signed integer minor units (10^-8 per major unit).
 *
 * Display rounds: each asset shows its own number of decimals (set under Asset types), or the
 * automatic size-based rule when it has none. Edit fields use `formatMinorToAmountString` instead,
 * so the exact stored value is always one tap away.
 */

import { autoDisplayDecimals, formatMinorRounded } from './amountMinor';

/**
 * Per-asset display decimals, refreshed every time the asset catalog is listed
 * (`assetTypesRepo.listAssetTypes`). A module cache instead of React state, so the many plain
 * formatting calls need no hook; screens reload the catalog on focus and re-render with it.
 */
const displayDecimalsByCurrency = new Map<string, number>();

export function setAssetDisplayDecimals(
  types: readonly { code: string; display_decimals: number | null }[]
): void {
  displayDecimalsByCurrency.clear();
  for (const t of types) {
    if (t.display_decimals != null) {
      displayDecimalsByCurrency.set(t.code.toUpperCase(), t.display_decimals);
    }
  }
}

/** Rounded amount without the currency code (e.g. chart centers that show the code elsewhere). */
export function formatMinorAmountForDisplay(minor: number, currency: string): string {
  const fixed = displayDecimalsByCurrency.get(currency.toUpperCase());
  if (fixed !== undefined) {
    return formatMinorRounded(minor, fixed, true);
  }
  return formatMinorRounded(minor, autoDisplayDecimals(minor), false);
}

export function formatMinorForDisplay(minor: number, currency: string): string {
  const c = currency.toUpperCase();
  return `${formatMinorAmountForDisplay(minor, c)} ${c}`;
}
