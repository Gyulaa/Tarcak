import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { validateEditorForSave } from '../src/domain/jarAdvancedEditorSave';
import type { SplitRow } from '../src/domain/jarAdvancedEditorTypes';

const row = (pocketId: string, percent: number): SplitRow => ({ pocketId, name: pocketId, percent });

const base = { currency: 'huf', defaultCeilingMinor: 0, milestones: [] };

describe('validateEditorForSave', () => {
  test('a full default split is saved as basis points', () => {
    const r = validateEditorForSave({ ...base, defaultSplits: [row('a', 60), row('b', 40)] });
    assert.ok(r.ok);
    assert.equal(r.payload.currency, 'HUF');
    assert.deepEqual(r.payload.defaultSplits, [
      { target_pocket_id: 'a', percent_bps: 6000 },
      { target_pocket_id: 'b', percent_bps: 4000 },
    ]);
  });

  test('a split under 100% is rejected here, not later by the database', () => {
    const r = validateEditorForSave({ ...base, defaultSplits: [row('a', 50), row('b', 30)] });
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.message : '', /100%/);
  });

  test('a split whose rounded basis points miss 100% is rejected', () => {
    const r = validateEditorForSave({
      ...base,
      defaultSplits: [row('a', 33.33), row('b', 33.33), row('c', 33.33)],
    });
    assert.equal(r.ok, false);
  });

  test('pockets left at 0% are dropped instead of failing the save', () => {
    const r = validateEditorForSave({ ...base, defaultSplits: [row('a', 100), row('b', 0)] });
    assert.ok(r.ok);
    assert.deepEqual(r.payload.defaultSplits, [{ target_pocket_id: 'a', percent_bps: 10_000 }]);
  });

  test('milestone splits follow the same rule', () => {
    const r = validateEditorForSave({
      ...base,
      defaultSplits: [row('a', 100)],
      milestones: [{ id: 'm1', thresholdMinor: 5, thresholdStr: '5', splits: [row('a', 70)] }],
    });
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.message : '', /Milestone 1/);
  });
});
