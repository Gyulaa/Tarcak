import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { splitAmountByBps } from '../src/domain/splitAmount.ts';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('splitAmountByBps', () => {
  test('a full split distributes every minor unit, the last share takes the remainder', () => {
    assert.deepEqual(splitAmountByBps(100, [3333, 3333, 3334]), [33, 33, 34]);
    assert.deepEqual(splitAmountByBps(10, [5000, 5000]), [5, 5]);
  });

  test('a partial split leaves the rest undistributed', () => {
    assert.deepEqual(splitAmountByBps(1000, [2500, 2500]), [250, 250]);
  });

  test('stays exact for large balances where float math drifts', () => {
    const total = Number.MAX_SAFE_INTEGER;
    const parts = splitAmountByBps(total, [3333, 3333, 3334]);
    assert.equal(sum(parts), total);
    assert.equal(parts[0], Number((BigInt(total) * 3333n) / 10_000n));
    // 1 234 567.89 units: total * bps exceeds 2^53 here
    const big = 123_456_789_000_000;
    assert.equal(sum(splitAmountByBps(big, [1, 9999])), big);
  });

  test('edge cases', () => {
    assert.deepEqual(splitAmountByBps(0, [10_000]), [0]);
    assert.deepEqual(splitAmountByBps(5, []), []);
    assert.throws(() => splitAmountByBps(5, [6000, 5000]), /exceed 100%/);
    assert.throws(() => splitAmountByBps(-5, [10_000]), /non-negative/);
    assert.throws(() => splitAmountByBps(1.5, [10_000]), /non-negative/);
  });
});
