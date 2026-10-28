/**
 * Integer money split for the basic Jar distribution (BigInt, so large balances stay exact).
 */

export const SPLIT_TOTAL_BPS = 10_000;

/**
 * Split `totalMinor` across `bpsList`.
 * Sum may be ≤ SPLIT_TOTAL_BPS; any undistributed portion stays in the Jar (caller's responsibility).
 * Last entry absorbs rounding remainder within the distributed portion.
 */
export function splitBigAmountByBps(totalMinor: bigint, bpsList: number[]): bigint[] {
  if (bpsList.length === 0) {
    return [];
  }
  if (totalMinor < 0n) {
    throw new Error('Amount to split must be a non-negative integer.');
  }
  const sum = bpsList.reduce((a, b) => a + b, 0);
  if (sum > SPLIT_TOTAL_BPS) {
    throw new Error('Split must not exceed 100%.');
  }
  const totalBps = BigInt(SPLIT_TOTAL_BPS);
  const totalToDistribute = (totalMinor * BigInt(sum)) / totalBps;
  const out: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < bpsList.length; i++) {
    if (i === bpsList.length - 1) {
      out.push(totalToDistribute - allocated);
    } else {
      const share = (totalMinor * BigInt(bpsList[i])) / totalBps;
      out.push(share);
      allocated += share;
    }
  }
  return out;
}

/** The same split for totals that fit a JS number. */
export function splitAmountByBps(totalMinor: number, bpsList: number[]): number[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new Error('Amount to split must be a non-negative integer.');
  }
  return splitBigAmountByBps(BigInt(totalMinor), bpsList).map(Number);
}

/**
 * Cuts an amount into transfers that each fit a JS number (a transaction row holds at most 2^53 - 1),
 * so a share of a very large balance is still booked exactly.
 */
export function chunkSafeAmount(amountMinor: bigint): number[] {
  if (amountMinor < 0n) {
    throw new Error('Amount must be a non-negative integer.');
  }
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const chunks: number[] = [];
  let rest = amountMinor;
  while (rest > 0n) {
    const part = rest > max ? max : rest;
    chunks.push(Number(part));
    rest -= part;
  }
  return chunks;
}
