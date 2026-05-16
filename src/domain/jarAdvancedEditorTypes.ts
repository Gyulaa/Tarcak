/**
 * Local editor state for Advanced Jar visual editor (not persisted directly).
 */

export type SplitRow = {
  pocketId: string;
  name: string;
  /** 0–100 display percent */
  percent: number;
};

export type EditorMilestone = {
  id: string;
  thresholdMinor: number;
  /** Editable threshold text (formatted amount). */
  thresholdStr: string;
  splits: SplitRow[];
};

export type EditorKnotId = 'default' | string;

export type EditorSelection =
  | { kind: 'edit'; knotId: EditorKnotId }
  | { kind: 'preview'; balanceMinor: number };

export type JarAdvancedEditorState = {
  currency: string;
  defaultCeilingMinor: number;
  defaultSplits: SplitRow[];
  milestones: EditorMilestone[];
  selection: EditorSelection;
};

export const JAR_ADV_TOTAL_BPS = 10_000;

export function splitRowsToBpsMap(rows: SplitRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.pocketId, Math.round(r.percent * 100));
  }
  return m;
}

export function bpsMapToSplitRows(
  bps: Map<string, number>,
  pocketNames: Map<string, string>
): SplitRow[] {
  const rows: SplitRow[] = [];
  for (const [pocketId, bpsVal] of bps) {
    rows.push({
      pocketId,
      name: pocketNames.get(pocketId) ?? '?',
      percent: bpsVal / 100,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function equalSplitPercents(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((10000 / count)) / 100;
  const out = Array(count).fill(base);
  let sum = out.reduce((a, v) => a + v, 0);
  let i = 0;
  while (sum < 100 && i < count * 100) {
    out[i % count] = Math.round((out[i % count] + 0.01) * 100) / 100;
    sum = out.reduce((a, v) => a + v, 0);
    i++;
  }
  return out;
}

export function normalizeSplitRowsTo100(rows: SplitRow[]): SplitRow[] {
  if (rows.length === 0) return rows;
  const frac = new Map<string, number>();
  for (const r of rows) {
    frac.set(r.pocketId, Math.max(0, r.percent));
  }
  let sum = 0;
  for (const v of frac.values()) sum += v;
  if (sum <= 0) {
    const eq = equalSplitPercents(rows.length);
    return rows.map((r, i) => ({ ...r, percent: eq[i] }));
  }
  const scaled = rows.map((r) => ({
    ...r,
    percent: Math.round(((r.percent / sum) * 100) * 100) / 100,
  }));
  let total = scaled.reduce((a, r) => a + r.percent, 0);
  if (Math.abs(total - 100) > 0.01 && scaled.length > 0) {
    const diff = Math.round((100 - total) * 100) / 100;
    scaled[0] = { ...scaled[0], percent: Math.round((scaled[0].percent + diff) * 100) / 100 };
  }
  return scaled;
}

export function splitsSumValid(rows: SplitRow[]): boolean {
  if (rows.length === 0) return false;
  const sum = rows.reduce((a, r) => a + r.percent, 0);
  return Math.abs(sum - 100) < 0.05;
}
