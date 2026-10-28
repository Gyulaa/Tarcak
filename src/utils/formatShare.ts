/** "42.5%" for part / total; "<0.1%" for a sliver, "" when there is no total to compare to. */
export function formatShare(part: number | bigint, total: number | bigint): string {
  // Shares only need a display precision of 0.1, so a float is fine here.
  const p = Math.abs(Number(part));
  const t = Math.abs(Number(total));
  if (!Number.isFinite(p) || !Number.isFinite(t) || t === 0) return '';
  const pct = (p / t) * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}
