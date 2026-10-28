import type { JarAdvancedAssetPayload } from '../db/repositories/jarAdvanced';
import { JAR_ADV_TOTAL_BPS, type EditorMilestone, type SplitRow } from './jarAdvancedEditorTypes';

/** Rows left at 0% are dropped: they carry no share and the database only accepts positive ones. */
export function splitRowsToPayload(
  rows: SplitRow[]
): { target_pocket_id: string; percent_bps: number }[] {
  return rows
    .map((r) => ({
      target_pocket_id: r.pocketId,
      percent_bps: Math.round(r.percent * 100),
    }))
    .filter((r) => r.percent_bps > 0);
}

/** Distribution needs every split to cover exactly 100%, checked on the basis points that are saved. */
function splitTotalError(
  payload: { percent_bps: number }[],
  label: string
): string | null {
  const sum = payload.reduce((a, r) => a + r.percent_bps, 0);
  if (sum === JAR_ADV_TOTAL_BPS) {
    return null;
  }
  return `${label} must total exactly 100% (now ${(sum / 100).toFixed(2)}%).`;
}

export function validateEditorForSave(params: {
  currency: string;
  defaultCeilingMinor: number;
  defaultSplits: SplitRow[];
  milestones: EditorMilestone[];
}): { ok: true; payload: JarAdvancedAssetPayload } | { ok: false; message: string } {
  if (!params.currency.trim()) {
    return { ok: false, message: 'Missing asset.' };
  }
  if (!Number.isInteger(params.defaultCeilingMinor) || params.defaultCeilingMinor < 0) {
    return { ok: false, message: 'Default ceiling must be a non-negative amount.' };
  }
  const defaultPayload = splitRowsToPayload(params.defaultSplits);
  const defaultError = splitTotalError(defaultPayload, 'Default split');
  if (defaultError) {
    return { ok: false, message: defaultError };
  }

  const milestonePayload = [];
  const thresholds: number[] = [];
  for (let i = 0; i < params.milestones.length; i++) {
    const m = params.milestones[i];
    if (!Number.isInteger(m.thresholdMinor) || m.thresholdMinor <= 0) {
      return { ok: false, message: `Milestone ${i + 1}: threshold must be positive.` };
    }
    if (m.thresholdMinor <= params.defaultCeilingMinor) {
      return {
        ok: false,
        message: `Milestone ${i + 1}: threshold must be greater than the default ceiling.`,
      };
    }
    const splits = splitRowsToPayload(m.splits);
    const splitError = splitTotalError(splits, `Milestone ${i + 1}: split`);
    if (splitError) {
      return { ok: false, message: splitError };
    }
    thresholds.push(m.thresholdMinor);
    milestonePayload.push({ thresholdMinor: m.thresholdMinor, splits });
  }

  const sorted = [...thresholds].sort((a, b) => a - b);
  for (let i = 0; i < thresholds.length; i++) {
    if (sorted[i] !== thresholds[i]) {
      return { ok: false, message: 'Milestones must be in ascending order by amount.' };
    }
    if (i > 0 && thresholds[i] === thresholds[i - 1]) {
      return { ok: false, message: 'Each milestone threshold must be unique.' };
    }
  }

  return {
    ok: true,
    payload: {
      currency: params.currency.trim().toUpperCase(),
      defaultCeilingMinor: params.defaultCeilingMinor,
      defaultSplits: defaultPayload,
      milestones: milestonePayload,
    },
  };
}
