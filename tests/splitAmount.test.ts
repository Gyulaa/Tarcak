import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { chunkSafeAmount, splitAmountByBps, splitBigAmountByBps } from '../src/domain/splitAmount';

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

describe('splitBigAmountByBps', () => {
  test('stays exact beyond 2^53 and distributes every unit', () => {
    const total = 9_007_199_254_740_993n * 1000n;
    const parts = splitBigAmountByBps(total, [3333, 3333, 3334]);
    assert.equal(
      parts.reduce((a, b) => a + b, 0n),
      total
    );
    assert.equal(parts[0], (total * 3333n) / 10_000n);
  });

  test('matches the number version for safe totals', () => {
    assert.deepEqual(
      splitBigAmountByBps(100n, [3333, 3333, 3334]).map(Number),
      splitAmountByBps(100, [3333, 3333, 3334])
    );
  });

  test('edge cases', () => {
    assert.deepEqual(splitBigAmountByBps(0n, [10_000]), [0n]);
    assert.deepEqual(splitBigAmountByBps(5n, []), []);
    assert.throws(() => splitBigAmountByBps(5n, [6000, 5000]), /exceed 100%/);
    assert.throws(() => splitBigAmountByBps(-5n, [10_000]), /non-negative/);
  });
});

describe('chunkSafeAmount', () => {
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);

  test('a safe amount is one chunk', () => {
    assert.deepEqual(chunkSafeAmount(0n), []);
    assert.deepEqual(chunkSafeAmount(42n), [42]);
    assert.deepEqual(chunkSafeAmount(MAX), [Number.MAX_SAFE_INTEGER]);
  });

  test('a larger amount is cut into safe chunks that add up exactly', () => {
    const amount = MAX * 2n + 7n;
    const chunks = chunkSafeAmount(amount);
    assert.equal(chunks.length, 3);
    assert.ok(chunks.every((c) => Number.isSafeInteger(c) && c > 0));
    assert.equal(
      chunks.reduce((a, c) => a + BigInt(c), 0n),
      amount
    );
  });

  test('rejects negative amounts', () => {
    assert.throws(() => chunkSafeAmount(-1n), /non-negative/);
  });
});
