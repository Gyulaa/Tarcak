/**
 * Chart layout + effective split preview for Advanced Jar visual editor.
 */

import {
  computeEffectiveBpsByPocket,
  fractionalWeightsToBpsMap,
  JAR_ADV_TOTAL_BPS,
  type MilestoneBps,
} from './jarAdvancedMath';
import type { EditorMilestone, JarAdvancedEditorState, SplitRow } from './jarAdvancedEditorTypes';
import { splitRowsToBpsMap } from './jarAdvancedEditorTypes';

export type ChartKnotKind = 'origin' | 'ceiling' | 'milestone';

export type ChartKnot = {
  id: string;
  kind: ChartKnotKind;
  balanceMinor: number;
  label: string;
  splits: SplitRow[];
};

export type ChartLayout = {
  minMinor: number;
  maxMinor: number;
  knots: ChartKnot[];
  plotLeft: number;
  plotWidth: number;
};

const PLOT_RIGHT_PAD = 12;

export const CHART_Y_LABEL_WIDTH = 40;
export const CHART_X_AXIS_HEIGHT = 22;
export const CHART_TOP_PAD = 8;

export type ChartPlotArea = {
  left: number;
  top: number;
  width: number;
  height: number;
  minMinor: number;
  maxMinor: number;
};

export type PocketLinePoint = {
  balanceMinor: number;
  percent: number;
};

export type PocketLineSeries = {
  pocketId: string;
  name: string;
  points: PocketLinePoint[];
};

export function computeChartMaxMinor(
  defaultCeilingMinor: number,
  milestones: EditorMilestone[]
): number {
  const last = milestones.length > 0 ? milestones[milestones.length - 1].thresholdMinor : 0;
  const base = Math.max(defaultCeilingMinor, last, 1);
  return Math.ceil(base * 1.15);
}

export function balanceToX(balanceMinor: number, layout: ChartLayout): number {
  const span = layout.maxMinor - layout.minMinor;
  if (span <= 0) return layout.plotLeft;
  const t = (balanceMinor - layout.minMinor) / span;
  return layout.plotLeft + t * layout.plotWidth;
}

export function xToBalance(x: number, layout: ChartLayout): number {
  const span = layout.maxMinor - layout.minMinor;
  if (layout.plotWidth <= 0) return layout.minMinor;
  const t = Math.max(0, Math.min(1, (x - layout.plotLeft) / layout.plotWidth));
  return Math.round(layout.minMinor + t * span);
}

/** Snap preview balance to a readable step on the axis. */
export function snapPreviewBalance(balanceMinor: number, maxMinor: number): number {
  const b = Math.max(0, Math.min(maxMinor, balanceMinor));
  if (maxMinor <= 100_000_000) return Math.round(b / 1000) * 1000;
  if (maxMinor <= 1_000_000_000_000) return Math.round(b / 100_000) * 100_000;
  return Math.round(b / 1_000_000_000) * 1_000_000_000;
}

export function buildChartLayout(
  state: Pick<JarAdvancedEditorState, 'defaultCeilingMinor' | 'defaultSplits' | 'milestones'>,
  chartWidth: number
): ChartLayout {
  const maxMinor = computeChartMaxMinor(state.defaultCeilingMinor, state.milestones);
  const plotWidth = Math.max(40, chartWidth - CHART_Y_LABEL_WIDTH - PLOT_RIGHT_PAD);
  const knots: ChartKnot[] = [
    {
      id: 'origin',
      kind: 'origin',
      balanceMinor: 0,
      label: '0',
      splits: state.defaultSplits,
    },
    {
      id: 'default',
      kind: 'ceiling',
      balanceMinor: state.defaultCeilingMinor,
      label: 'ceiling',
      splits: state.defaultSplits,
    },
  ];
  const sorted = [...state.milestones].sort((a, b) => a.thresholdMinor - b.thresholdMinor);
  sorted.forEach((m, i) => {
    knots.push({
      id: m.id,
      kind: 'milestone',
      balanceMinor: m.thresholdMinor,
      label: `M${i + 1}`,
      splits: m.splits,
    });
  });
  return {
    minMinor: 0,
    maxMinor,
    knots,
    plotLeft: CHART_Y_LABEL_WIDTH,
    plotWidth,
  };
}

export function milestonesToMath(
  milestones: EditorMilestone[]
): MilestoneBps[] {
  return milestones.map((m) => ({
    thresholdMinor: m.thresholdMinor,
    bps: splitRowsToBpsMap(m.splits),
  }));
}

export function effectiveBpsAtBalance(
  state: Pick<JarAdvancedEditorState, 'defaultCeilingMinor' | 'defaultSplits' | 'milestones'>,
  balanceMinor: number
): Map<string, number> {
  const defaultBps = splitRowsToBpsMap(state.defaultSplits);
  const milestoneBps = milestonesToMath(state.milestones);
  if (state.milestones.length === 0) {
    return new Map(defaultBps);
  }
  try {
    return computeEffectiveBpsByPocket(
      balanceMinor,
      state.defaultCeilingMinor,
      defaultBps,
      milestoneBps
    );
  } catch {
    return new Map(defaultBps);
  }
}

export function effectiveSplitRowsAtBalance(
  state: Pick<JarAdvancedEditorState, 'defaultCeilingMinor' | 'defaultSplits' | 'milestones'>,
  balanceMinor: number,
  pocketNames: Map<string, string>
): SplitRow[] {
  const bps = effectiveBpsAtBalance(state, balanceMinor);
  const rows: SplitRow[] = [];
  for (const [pocketId, bpsVal] of bps) {
    rows.push({
      pocketId,
      name: pocketNames.get(pocketId) ?? '?',
      percent: bpsVal / 100,
    });
  }
  rows.sort((a, b) => b.percent - a.percent);
  return rows;
}

export function previewBpsFromRows(rows: SplitRow[]): Map<string, number> {
  const frac = new Map<string, number>();
  for (const r of rows) {
    if (r.percent > 0) frac.set(r.pocketId, r.percent / 100);
  }
  return fractionalWeightsToBpsMap(frac);
}

export function suggestMilestoneBalance(
  state: Pick<JarAdvancedEditorState, 'defaultCeilingMinor' | 'milestones'>,
  previewBalance?: number
): number {
  if (previewBalance != null && previewBalance > state.defaultCeilingMinor) {
    return snapPreviewBalance(previewBalance, computeChartMaxMinor(state.defaultCeilingMinor, state.milestones));
  }
  const sorted = [...state.milestones].sort((a, b) => a.thresholdMinor - b.thresholdMinor);
  if (sorted.length === 0) {
    return Math.max(state.defaultCeilingMinor + 100_000_000, 100_000_000);
  }
  const last = sorted[sorted.length - 1].thresholdMinor;
  return snapPreviewBalance(last * 1.25, computeChartMaxMinor(state.defaultCeilingMinor, state.milestones));
}

export function buildChartPlotArea(
  layout: ChartLayout,
  chartHeight: number
): ChartPlotArea {
  const top = CHART_TOP_PAD;
  const height = Math.max(
    80,
    chartHeight - top - CHART_X_AXIS_HEIGHT - 4
  );
  return {
    left: layout.plotLeft,
    top,
    width: layout.plotWidth,
    height,
    minMinor: layout.minMinor,
    maxMinor: layout.maxMinor,
  };
}

export function balanceToXInPlot(balanceMinor: number, plot: ChartPlotArea): number {
  const span = plot.maxMinor - plot.minMinor;
  if (span <= 0) return plot.left;
  const t = (balanceMinor - plot.minMinor) / span;
  return plot.left + t * plot.width;
}

export function percentToYInPlot(percent: number, plot: ChartPlotArea): number {
  const p = Math.max(0, Math.min(100, percent));
  return plot.top + plot.height * (1 - p / 100);
}

export function xToBalanceInPlot(x: number, plot: ChartPlotArea): number {
  const span = plot.maxMinor - plot.minMinor;
  if (plot.width <= 0) return plot.minMinor;
  const t = Math.max(0, Math.min(1, (x - plot.left) / plot.width));
  return Math.round(plot.minMinor + t * span);
}

/** Pocket ids that appear in default or any milestone split. */
export function collectPocketIdsInRules(
  state: Pick<JarAdvancedEditorState, 'defaultSplits' | 'milestones'>
): string[] {
  const ids = new Set<string>();
  for (const r of state.defaultSplits) {
    ids.add(r.pocketId);
  }
  for (const m of state.milestones) {
    for (const r of m.splits) {
      ids.add(r.pocketId);
    }
  }
  return [...ids];
}

function sampleBalancesForChart(maxMinor: number, knots: ChartKnot[], sampleCount: number): number[] {
  const critical = new Set<number>([0, maxMinor]);
  for (const k of knots) {
    if (k.kind !== 'origin') critical.add(k.balanceMinor);
  }
  const out = [...critical].sort((a, b) => a - b);
  const extra = Math.max(0, sampleCount - out.length);
  for (let i = 0; i <= extra; i++) {
    const b = Math.round((maxMinor * i) / Math.max(1, extra));
    if (!out.includes(b)) out.push(b);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** One line per pocket: effective % (0–100) across Jar balance. */
export function buildPocketLineSeries(
  state: Pick<JarAdvancedEditorState, 'defaultCeilingMinor' | 'defaultSplits' | 'milestones'>,
  layout: ChartLayout,
  pocketNames: Map<string, string>,
  sampleCount = 48
): PocketLineSeries[] {
  const pocketIds = collectPocketIdsInRules(state);
  const balances = sampleBalancesForChart(layout.maxMinor, layout.knots, sampleCount);
  return pocketIds.map((pocketId) => {
    const points: PocketLinePoint[] = balances.map((balanceMinor) => {
      const bps = effectiveBpsAtBalance(state, balanceMinor);
      const bpsVal = bps.get(pocketId) ?? 0;
      return {
        balanceMinor,
        percent: bpsVal / 100,
      };
    });
    return {
      pocketId,
      name: pocketNames.get(pocketId) ?? '?',
      points,
    };
  });
}

export const Y_AXIS_TICK_PERCENTS = [0, 25, 50, 75, 100] as const;

export function axisTickBalances(maxMinor: number, count = 4): number[] {
  if (maxMinor <= 0) return [0];
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((maxMinor * i) / count));
  }
  return ticks;
}

/** Dev-only sanity checks for chart math. */
export function runJarAdvancedChartModelSelfTest(): void {
  const defaultBps = new Map([
    ['a', 5000],
    ['b', 5000],
  ]);
  const milestones: MilestoneBps[] = [
    { thresholdMinor: 100, bps: new Map([['a', 8000], ['b', 2000]]) },
    { thresholdMinor: 200, bps: new Map([['a', 2000], ['b', 8000]]) },
  ];
  const at50 = computeEffectiveBpsByPocket(50, 80, defaultBps, milestones);
  if (at50.get('a') !== 5000) throw new Error('selfTest: at ceiling zone');
  const at250 = computeEffectiveBpsByPocket(250, 80, defaultBps, milestones);
  if (at250.get('a') !== 2000) throw new Error('selfTest: at last milestone');
  const at150 = computeEffectiveBpsByPocket(150, 80, defaultBps, milestones);
  if (at150.get('a') !== 5000) throw new Error('selfTest: mid lerp');
  const mid = at150;
  let sum = 0;
  for (const v of mid.values()) sum += v;
  if (sum !== JAR_ADV_TOTAL_BPS) throw new Error('selfTest: bps sum');
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    runJarAdvancedChartModelSelfTest();
  } catch {
    /* ignore in dev hot reload */
  }
}
