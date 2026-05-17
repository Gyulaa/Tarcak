import type { JarAdvancedAssetPayload } from '../db/repositories/jarAdvanced';
import {
  splitsSumValid,
  type EditorMilestone,
  type SplitRow,
} from './jarAdvancedEditorTypes';

export function splitRowsToPayload(
  rows: SplitRow[]
): { target_pocket_id: string; percent_bps: number }[] {
  return rows.map((r) => ({
    target_pocket_id: r.pocketId,
    percent_bps: Math.round(r.percent * 100),
  }));
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
  if (!splitsSumValid(params.defaultSplits)) {
    return { ok: false, message: 'Default split must have at least one pocket above 0% and must not exceed 100%.' };
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
    if (!splitsSumValid(m.splits)) {
      return { ok: false, message: `Milestone ${i + 1}: split must have at least one pocket above 0% and must not exceed 100%.` };
    }
    thresholds.push(m.thresholdMinor);
    milestonePayload.push({
      thresholdMinor: m.thresholdMinor,
      splits: splitRowsToPayload(m.splits),
    });
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
      defaultSplits: splitRowsToPayload(params.defaultSplits),
      milestones: milestonePayload,
    },
  };
}
