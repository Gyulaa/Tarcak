import * as Crypto from 'expo-crypto';

import {
  assertBpsMapSumsTotal,
  computeEffectiveBpsByPocket,
  JAR_ADV_TOTAL_BPS,
  type MilestoneBps,
} from '../../domain/jarAdvancedMath';
import { openMainDatabase } from '../client';
import * as assetTypesRepo from './assetTypes';
import * as pocketsRepo from './pockets';

const TOTAL = JAR_ADV_TOTAL_BPS;

export type JarAdvancedMilestonePayload = {
  thresholdMinor: number;
  splits: { target_pocket_id: string; percent_bps: number }[];
};

export type JarAdvancedAssetPayload = {
  currency: string;
  defaultCeilingMinor: number;
  defaultSplits: { target_pocket_id: string; percent_bps: number }[];
  milestones: JarAdvancedMilestonePayload[];
};

export type JarAdvancedAssetSummary = {
  id: string;
  currency: string;
  defaultCeilingMinor: number;
  milestoneCount: number;
};

export type JarAdvancedAssetDetail = {
  id: string;
  currency: string;
  defaultCeilingMinor: number;
  defaultSplits: { target_pocket_id: string; percent_bps: number }[];
  milestones: {
    id: string;
    thresholdMinor: number;
    splits: { target_pocket_id: string; percent_bps: number }[];
  }[];
};

function validateSplits(
  entries: { target_pocket_id: string; percent_bps: number }[],
  jarId: string,
  label: string
): void {
  if (entries.length === 0) {
    throw new Error(`${label}: add at least one pocket.`);
  }
  const seen = new Set<string>();
  let sum = 0;
  for (const e of entries) {
    if (seen.has(e.target_pocket_id)) {
      throw new Error(`${label}: each pocket can only appear once.`);
    }
    seen.add(e.target_pocket_id);
    if (!Number.isInteger(e.percent_bps) || e.percent_bps <= 0 || e.percent_bps > TOTAL) {
      throw new Error(`${label}: percentages must be between 0.01 and 100.`);
    }
    if (e.target_pocket_id === jarId) {
      throw new Error(`${label}: the Jar cannot be a target.`);
    }
    sum += e.percent_bps;
  }
  if (sum !== TOTAL) {
    throw new Error(`${label}: must total 100% (currently ${(sum / 100).toFixed(2)}%).`);
  }
}

export async function listJarAdvancedCurrencies(): Promise<string[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<{ currency: string }>(
    `SELECT currency FROM jar_advanced_assets ORDER BY currency COLLATE NOCASE ASC`
  );
  return rows.map((r) => r.currency);
}

export async function listJarAdvancedSummaries(): Promise<JarAdvancedAssetSummary[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<{ id: string; currency: string; default_ceiling_minor: number }>(
    `SELECT id, currency, default_ceiling_minor FROM jar_advanced_assets ORDER BY currency COLLATE NOCASE ASC`
  );
  const out: JarAdvancedAssetSummary[] = [];
  for (const r of rows) {
    const c = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM jar_advanced_milestones WHERE asset_id = ?`,
      [r.id]
    );
    out.push({
      id: r.id,
      currency: r.currency,
      defaultCeilingMinor: r.default_ceiling_minor,
      milestoneCount: c?.n ?? 0,
    });
  }
  return out;
}

export async function getJarAdvancedAssetDetail(currency: string): Promise<JarAdvancedAssetDetail | null> {
  const code = currency.trim().toUpperCase();
  const db = await openMainDatabase();
  const asset = await db.getFirstAsync<{
    id: string;
    currency: string;
    default_ceiling_minor: number;
  }>(`SELECT id, currency, default_ceiling_minor FROM jar_advanced_assets WHERE currency = ?`, [code]);
  if (!asset) {
    return null;
  }
  const defRows = await db.getAllAsync<{
    target_pocket_id: string;
    percent_bps: number;
  }>(
    `SELECT target_pocket_id, percent_bps FROM jar_advanced_default_splits
     WHERE asset_id = ? ORDER BY sort_index ASC`,
    [asset.id]
  );
  const mileRows = await db.getAllAsync<{ id: string; threshold_minor: number }>(
    `SELECT id, threshold_minor FROM jar_advanced_milestones WHERE asset_id = ? ORDER BY threshold_minor ASC`,
    [asset.id]
  );
  const milestones: JarAdvancedAssetDetail['milestones'] = [];
  for (const m of mileRows) {
    const spl = await db.getAllAsync<{ target_pocket_id: string; percent_bps: number }>(
      `SELECT target_pocket_id, percent_bps FROM jar_advanced_milestone_splits
       WHERE milestone_id = ? ORDER BY sort_index ASC`,
      [m.id]
    );
    milestones.push({
      id: m.id,
      thresholdMinor: m.threshold_minor,
      splits: spl.map((x) => ({
        target_pocket_id: x.target_pocket_id,
        percent_bps: x.percent_bps,
      })),
    });
  }
  return {
    id: asset.id,
    currency: asset.currency,
    defaultCeilingMinor: asset.default_ceiling_minor,
    defaultSplits: defRows.map((x) => ({
      target_pocket_id: x.target_pocket_id,
      percent_bps: x.percent_bps,
    })),
    milestones,
  };
}

/** Config for distribution math; null if this currency has no advanced row. */
export async function getJarAdvancedDistributeConfig(
  currency: string
): Promise<{
  defaultCeilingMinor: number;
  defaultBps: Map<string, number>;
  milestones: MilestoneBps[];
} | null> {
  const detail = await getJarAdvancedAssetDetail(currency);
  if (!detail) {
    return null;
  }
  const defaultBps = new Map<string, number>();
  for (const s of detail.defaultSplits) {
    defaultBps.set(s.target_pocket_id, s.percent_bps);
  }
  const milestones: MilestoneBps[] = detail.milestones.map((m) => {
    const bps = new Map<string, number>();
    for (const s of m.splits) {
      bps.set(s.target_pocket_id, s.percent_bps);
    }
    return { thresholdMinor: m.thresholdMinor, bps };
  });
  return {
    defaultCeilingMinor: detail.defaultCeilingMinor,
    defaultBps,
    milestones,
  };
}

export async function deleteJarAdvancedAsset(currency: string): Promise<void> {
  const code = currency.trim().toUpperCase();
  const db = await openMainDatabase();
  await db.runAsync(`DELETE FROM jar_advanced_assets WHERE currency = ?`, [code]);
}

export async function saveJarAdvancedAsset(payload: JarAdvancedAssetPayload): Promise<void> {
  const jar = await pocketsRepo.getJarPocket();
  if (!jar) {
    throw new Error('Jar pocket is missing.');
  }
  const currency = payload.currency.trim().toUpperCase();
  if (!(await assetTypesRepo.currencyExists(currency))) {
    throw new Error(`Add "${currency}" under Asset types first.`);
  }
  if (!Number.isInteger(payload.defaultCeilingMinor) || payload.defaultCeilingMinor < 0) {
    throw new Error('Default ceiling must be a non-negative amount.');
  }
  validateSplits(payload.defaultSplits, jar.id, 'Default split');
  for (let i = 0; i < payload.milestones.length; i++) {
    const m = payload.milestones[i];
    if (!Number.isInteger(m.thresholdMinor) || m.thresholdMinor <= 0) {
      throw new Error(`Milestone ${i + 1}: threshold must be positive.`);
    }
    if (m.thresholdMinor <= payload.defaultCeilingMinor) {
      throw new Error(
        `Milestone ${i + 1}: threshold must be greater than the default ceiling (${payload.defaultCeilingMinor} minor).`
      );
    }
    validateSplits(m.splits, jar.id, `Milestone ${i + 1}`);
  }
  const thresholds = payload.milestones.map((m) => m.thresholdMinor);
  const sortedT = [...thresholds].sort((a, b) => a - b);
  for (let i = 0; i < sortedT.length; i++) {
    if (sortedT[i] !== thresholds[i]) {
      throw new Error('Milestones must be listed in ascending threshold order.');
    }
    if (i > 0 && sortedT[i] === sortedT[i - 1]) {
      throw new Error('Milestone thresholds must be unique.');
    }
  }

  const db = await openMainDatabase();
  const now = Date.now();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM jar_advanced_assets WHERE currency = ?`,
    [currency]
  );
  const assetId = existing?.id ?? Crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    if (existing) {
      await db.runAsync(`DELETE FROM jar_advanced_milestones WHERE asset_id = ?`, [assetId]);
      await db.runAsync(`DELETE FROM jar_advanced_default_splits WHERE asset_id = ?`, [assetId]);
      await db.runAsync(
        `UPDATE jar_advanced_assets SET default_ceiling_minor = ?, updated_at = ? WHERE id = ?`,
        [payload.defaultCeilingMinor, now, assetId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO jar_advanced_assets (id, currency, default_ceiling_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [assetId, currency, payload.defaultCeilingMinor, now, now]
      );
    }
    let sort = 0;
    for (const s of payload.defaultSplits) {
      const id = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO jar_advanced_default_splits (id, asset_id, target_pocket_id, percent_bps, sort_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, assetId, s.target_pocket_id, s.percent_bps, sort++, now, now]
      );
    }
    let mi = 0;
    for (const m of payload.milestones) {
      const mid = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO jar_advanced_milestones (id, asset_id, threshold_minor, sort_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [mid, assetId, m.thresholdMinor, mi++, now, now]
      );
      sort = 0;
      for (const s of m.splits) {
        const sid = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO jar_advanced_milestone_splits (id, milestone_id, target_pocket_id, percent_bps, sort_index, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sid, mid, s.target_pocket_id, s.percent_bps, sort++, now, now]
        );
      }
    }
  });
}

/** Resolve effective bps map for a balance (throws if advanced config invalid for this balance). */
export function resolveAdvancedEffectiveBps(
  balanceMinor: number,
  cfg: { defaultCeilingMinor: number; defaultBps: Map<string, number>; milestones: MilestoneBps[] }
): Map<string, number> {
  assertBpsMapSumsTotal(cfg.defaultBps);
  for (const m of cfg.milestones) {
    assertBpsMapSumsTotal(m.bps);
  }
  if (balanceMinor <= cfg.defaultCeilingMinor) {
    return new Map(cfg.defaultBps);
  }
  if (cfg.milestones.length === 0) {
    throw new Error('Add at least one milestone above the default ceiling, or use the basic split as fallback.');
  }
  return computeEffectiveBpsByPocket(
    balanceMinor,
    cfg.defaultCeilingMinor,
    cfg.defaultBps,
    cfg.milestones
  );
}
