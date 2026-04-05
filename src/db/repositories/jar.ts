import * as Crypto from 'expo-crypto';

import type { JarDistributionRule } from '../../domain/types';
import { JAR_ADV_TOTAL_BPS } from '../../domain/jarAdvancedMath';
import { openMainDatabase } from '../client';
import * as jarAdvancedRepo from './jarAdvanced';
import * as pocketsRepo from './pockets';
import * as settingsRepo from './settings';
import * as txRepo from './transactions';

const TOTAL_BPS = 10_000;

type RuleRow = {
  id: string;
  target_pocket_id: string;
  percent_bps: number;
  sort_index: number;
  target_pocket_name: string;
};

function mapRuleRow(r: RuleRow): JarDistributionRule {
  return {
    id: r.id,
    target_pocket_id: r.target_pocket_id,
    target_pocket_name: r.target_pocket_name,
    percent_bps: r.percent_bps,
    sort_index: r.sort_index,
  };
}

/** Split `totalMinor` across `bpsList` (sum must be TOTAL_BPS). Last entry absorbs remainder. */
export function splitAmountByBps(totalMinor: number, bpsList: number[]): number[] {
  if (bpsList.length === 0) {
    return [];
  }
  const sum = bpsList.reduce((a, b) => a + b, 0);
  if (sum !== TOTAL_BPS) {
    throw new Error('Split must total 100%.');
  }
  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < bpsList.length; i++) {
    if (i === bpsList.length - 1) {
      out.push(totalMinor - allocated);
    } else {
      const share = Math.floor((totalMinor * bpsList[i]) / TOTAL_BPS);
      out.push(share);
      allocated += share;
    }
  }
  return out;
}

export async function listJarDistributionRules(): Promise<JarDistributionRule[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<RuleRow>(
    `SELECT r.id, r.target_pocket_id, r.percent_bps, r.sort_index, p.name AS target_pocket_name
     FROM jar_distribution_rules r
     JOIN pockets p ON p.id = r.target_pocket_id
     ORDER BY r.sort_index ASC, p.name COLLATE NOCASE ASC`
  );
  return rows.map(mapRuleRow);
}

export async function replaceJarDistributionRules(
  entries: { target_pocket_id: string; percent_bps: number }[]
): Promise<void> {
  if (entries.length === 0) {
    throw new Error('Add at least one pocket to the split.');
  }
  const jar = await pocketsRepo.getJarPocket();
  if (!jar) {
    throw new Error('Jar pocket is missing.');
  }
  const seen = new Set<string>();
  let sum = 0;
  for (const e of entries) {
    if (seen.has(e.target_pocket_id)) {
      throw new Error('Each pocket can only appear once in the split.');
    }
    seen.add(e.target_pocket_id);
    if (!Number.isInteger(e.percent_bps) || e.percent_bps <= 0 || e.percent_bps > TOTAL_BPS) {
      throw new Error('Each percentage must be between 0.01% and 100%.');
    }
    if (e.target_pocket_id === jar.id) {
      throw new Error('The Jar cannot be a split target.');
    }
    const p = await pocketsRepo.getPocket(e.target_pocket_id);
    if (!p || p.is_jar) {
      throw new Error('Invalid target pocket.');
    }
    sum += e.percent_bps;
  }
  if (sum !== TOTAL_BPS) {
    throw new Error(`Percentages must add up to 100% (currently ${(sum / 100).toFixed(2)}%).`);
  }

  const db = await openMainDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM jar_distribution_rules`);
    let sort = 0;
    for (const e of entries) {
      const id = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO jar_distribution_rules (id, target_pocket_id, percent_bps, sort_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, e.target_pocket_id, e.percent_bps, sort++, now, now]
      );
    }
  });
}

/**
 * Transfers the full Jar balance for `currency` to target pockets using saved rules (one transfer per non-zero share).
 */
export async function distributeJarCurrency(params: {
  currency: string;
  title?: string;
}): Promise<number> {
  const jar = await pocketsRepo.getJarPocket();
  if (!jar) {
    throw new Error('Jar pocket is missing.');
  }
  if (jar.archived) {
    throw new Error('Jar is archived. Turn on Pool & distribute in Settings to use it.');
  }
  const currency = params.currency.trim().toUpperCase();
  const balances = await txRepo.sumBalancesForPocket(jar.id);
  const row = balances.find((b) => b.currency === currency);
  const totalMinor = row?.balance_minor ?? 0;
  if (totalMinor <= 0) {
    throw new Error('No balance to distribute for this asset in the Jar.');
  }

  const basicRules = await listJarDistributionRules();
  const advancedOn = await settingsRepo.getAdvancedJarEnabled();
  const advCfg = advancedOn ? await jarAdvancedRepo.getJarAdvancedDistributeConfig(currency) : null;

  let ordered: { target_pocket_id: string; percent_bps: number }[] = [];

  if (advancedOn) {
    if (!advCfg) {
      throw new Error(
        `No Advanced Jar rules for ${currency}. Open Advanced Jar from the Jar screen and add this asset, or turn off Advanced Jar in Settings to use the basic split.`
      );
    }
    const bpsMap = jarAdvancedRepo.resolveAdvancedEffectiveBps(totalMinor, advCfg);
    let sum = 0;
    for (const v of bpsMap.values()) {
      sum += v;
    }
    if (sum !== JAR_ADV_TOTAL_BPS) {
      throw new Error('Internal split error.');
    }
    ordered = [...bpsMap.entries()]
      .filter(([, bps]) => bps > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([target_pocket_id, percent_bps]) => ({ target_pocket_id, percent_bps }));
  } else {
    if (basicRules.length === 0) {
      throw new Error('Set up your split first (Edit split).');
    }
    ordered = basicRules.map((r) => ({
      target_pocket_id: r.target_pocket_id,
      percent_bps: r.percent_bps,
    }));
  }

  const bpsList = ordered.map((x) => x.percent_bps);
  const parts = splitAmountByBps(totalMinor, bpsList);
  const title = (params.title ?? 'Jar distribution').trim() || 'Jar distribution';
  const occurred_at = Date.now();
  let count = 0;
  for (let i = 0; i < ordered.length; i++) {
    const amt = parts[i];
    if (amt <= 0) {
      continue;
    }
    await txRepo.insertTransfer({
      title,
      amount_minor: amt,
      currency,
      occurred_at,
      from_pocket_id: jar.id,
      to_pocket_id: ordered[i].target_pocket_id,
    });
    count += 1;
  }
  if (count === 0) {
    throw new Error('Nothing to transfer (amounts rounded to zero). Try adjusting the split.');
  }
  return count;
}
