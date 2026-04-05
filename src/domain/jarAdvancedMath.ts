/**
 * Pure math for Advanced Jar: linear interpolation of percentage targets between knots, then integer bps.
 */

export const JAR_ADV_TOTAL_BPS = 10_000;

export type MilestoneBps = { thresholdMinor: number; bps: Map<string, number> };

/** Convert fractional weights (any positive, need not sum to 1) to integer bps summing to JAR_ADV_TOTAL_BPS. */
export function fractionalWeightsToBpsMap(frac: Map<string, number>): Map<string, number> {
  const ids = [...frac.keys()].filter((k) => (frac.get(k) ?? 0) > 1e-15);
  if (ids.length === 0) {
    throw new Error('Empty split.');
  }
  const sumW = ids.reduce((a, k) => a + (frac.get(k) ?? 0), 0);
  if (sumW <= 0) {
    throw new Error('Invalid split weights.');
  }
  const weighted = ids.map((id) => {
    const w = (frac.get(id) ?? 0) / sumW;
    const raw = w * JAR_ADV_TOTAL_BPS;
    const fl = Math.floor(raw);
    const rem = raw - fl;
    return { id, fl, rem };
  });
  let allocated = weighted.reduce((a, x) => a + x.fl, 0);
  let remainder = JAR_ADV_TOTAL_BPS - allocated;
  weighted.sort((a, b) => b.rem - a.rem);
  const out = new Map<string, number>();
  for (let i = 0; i < weighted.length; i++) {
    out.set(weighted[i].id, weighted[i].fl + (i < remainder ? 1 : 0));
  }
  return out;
}

function lerpBpsMaps(
  balanceMinor: number,
  lowerKnot: number,
  upperKnot: number,
  lowerBps: Map<string, number>,
  upperBps: Map<string, number>
): Map<string, number> {
  if (upperKnot <= lowerKnot) {
    throw new Error('Invalid milestone ordering.');
  }
  const t = Math.max(0, Math.min(1, (balanceMinor - lowerKnot) / (upperKnot - lowerKnot)));
  const keys = new Set<string>([...lowerBps.keys(), ...upperBps.keys()]);
  const frac = new Map<string, number>();
  for (const k of keys) {
    const a = (lowerBps.get(k) ?? 0) / JAR_ADV_TOTAL_BPS;
    const b = (upperBps.get(k) ?? 0) / JAR_ADV_TOTAL_BPS;
    const v = a + t * (b - a);
    if (v > 1e-12) {
      frac.set(k, v);
    }
  }
  return fractionalWeightsToBpsMap(frac);
}

/**
 * @param balanceMinor — current Jar balance in this asset (minor units)
 * @param defaultCeilingMinor — flat default split applies while balance <= this
 * @param defaultBps — pocket id -> bps, sum 10000
 * @param milestones — sorted by threshold ascending by caller
 */
export function computeEffectiveBpsByPocket(
  balanceMinor: number,
  defaultCeilingMinor: number,
  defaultBps: Map<string, number>,
  milestones: MilestoneBps[]
): Map<string, number> {
  if (balanceMinor <= defaultCeilingMinor) {
    return new Map(defaultBps);
  }
  const sorted = [...milestones].sort((a, b) => a.thresholdMinor - b.thresholdMinor);
  if (sorted.length === 0) {
    throw new Error('No milestones above default ceiling.');
  }
  const T = sorted.map((m) => m.thresholdMinor);
  const D = sorted.map((m) => m.bps);

  if (balanceMinor < T[0]) {
    return lerpBpsMaps(balanceMinor, defaultCeilingMinor, T[0], defaultBps, D[0]);
  }
  for (let i = 0; i < T.length - 1; i++) {
    const Ti = T[i];
    const Tnext = T[i + 1];
    if (balanceMinor < Tnext) {
      return lerpBpsMaps(balanceMinor, Ti, Tnext, D[i], D[i + 1]);
    }
  }
  return new Map(D[D.length - 1]);
}

export function assertBpsMapSumsTotal(m: Map<string, number>): void {
  let s = 0;
  for (const v of m.values()) {
    s += v;
  }
  if (s !== JAR_ADV_TOTAL_BPS) {
    throw new Error(`Split must total 100% (got ${s / 100}%).`);
  }
}
