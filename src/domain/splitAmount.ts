/**
 * Integer money split for the basic Jar distribution (BigInt, so large balances stay exact).
 */

export const SPLIT_TOTAL_BPS = 10_000;

/**
 * Split `totalMinor` across `bpsList`.
 * Sum may be ≤ SPLIT_TOTAL_BPS; any undistributed portion stays in the Jar (caller's responsibility).
 * Last entry absorbs rounding remainder within the distributed portion.
 */
export function splitAmountByBps(totalMinor: number, bpsList: number[]): number[] {
  if (bpsList.length === 0) {
    return [];
  }
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new Error('Amount to split must be a non-negative integer.');
  }
  const sum = bpsList.reduce((a, b) => a + b, 0);
  if (sum > SPLIT_TOTAL_BPS) {
    throw new Error('Split must not exceed 100%.');
  }
  const total = BigInt(totalMinor);
  const totalBps = BigInt(SPLIT_TOTAL_BPS);
  const totalToDistribute = (total * BigInt(sum)) / totalBps;
  const out: number[] = [];
  let allocated = 0n;
  for (let i = 0; i < bpsList.length; i++) {
    if (i === bpsList.length - 1) {
      out.push(Number(totalToDistribute - allocated));
    } else {
      const share = (total * BigInt(bpsList[i])) / totalBps;
      out.push(Number(share));
      allocated += share;
    }
  }
  return out;
}
