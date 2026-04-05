/**
 * Amounts are stored as signed integers: one major currency unit = 10^8 minor units
 * (8 decimal places). This avoids float drift and supports values like 0.00000001.
 *
 * Legacy DB v1 used 10^-2 per minor unit; migration 0002 multiplies those rows by 10^6.
 */

export const AMOUNT_MINOR_SCALE = 100_000_000;
const SCALE_BI = BigInt(AMOUNT_MINOR_SCALE);

/**
 * Groups integer digits with a space every three from the right (e.g. 1000 → "1 000").
 * `intPart` must be non-negative digits only (no sign).
 */
export function formatIntegerPartWithSpaces(intPart: string): string {
  const digits = intPart.replace(/\D/g, '');
  if (digits === '') {
    return '0';
  }
  const rev = digits.split('').reverse();
  const groups: string[] = [];
  for (let i = 0; i < rev.length; i += 3) {
    groups.push(rev.slice(i, i + 3).reverse().join(''));
  }
  return groups.reverse().join(' ');
}

/** v1 minor (e.g. cents) → v2 minor (10^-8 major). */
export const LEGACY_MINOR_TO_CURRENT_MULTIPLIER = 1_000_000;

/**
 * Parse a human decimal string (optional leading minus) into minor units.
 * At most 8 digits after the decimal point.
 */
export function parseAmountStringToMinor(raw: string): number {
  const s0 = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (!s0) {
    throw new Error('Enter an amount.');
  }
  const neg = s0.startsWith('-');
  let s = neg ? s0.slice(1) : s0;
  if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!s || s === '.') {
    throw new Error('Enter an amount.');
  }
  if (!/^\d*\.?\d*$/.test(s)) {
    throw new Error('Use digits and at most one decimal point.');
  }
  const dot = s.indexOf('.');
  const intPart = dot === -1 ? s : s.slice(0, dot);
  let frac = dot === -1 ? '' : s.slice(dot + 1);
  if (frac.length > 8) {
    throw new Error('At most 8 decimal places.');
  }
  const intStr = intPart === '' ? '0' : intPart;
  frac = frac.padEnd(8, '0');
  const bi = BigInt(intStr) * SCALE_BI + BigInt(frac);
  const signed = neg ? -bi : bi;
  const n = Number(signed);
  if (!Number.isSafeInteger(n)) {
    throw new Error('Amount is too large.');
  }
  if (n === 0) {
    throw new Error('Amount must not be zero.');
  }
  return n;
}

/** Minor units → decimal string for editing (no scientific notation). */
export function formatMinorToAmountString(minor: number): string {
  if (!Number.isInteger(minor)) {
    throw new Error('Internal error: amount must be an integer.');
  }
  let bi = BigInt(minor);
  const neg = bi < 0n;
  if (neg) {
    bi = -bi;
  }
  const whole = bi / SCALE_BI;
  const frac = bi % SCALE_BI;
  const wholeStr = formatIntegerPartWithSpaces(whole.toString());
  if (frac === 0n) {
    return `${neg ? '-' : ''}${wholeStr}`;
  }
  const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${wholeStr}.${fracStr}`;
}
