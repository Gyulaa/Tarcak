import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatShare } from '../src/utils/formatShare';

describe('formatShare', () => {
  test('rounds to one decimal', () => {
    assert.equal(formatShare(1, 3), '33.3%');
    assert.equal(formatShare(1, 1), '100.0%');
  });

  test('takes bigint minor amounts and ignores the sign', () => {
    assert.equal(formatShare(-250_000_000n, -1_000_000_000n), '25.0%');
  });

  test('marks a sliver instead of showing 0.0%', () => {
    assert.equal(formatShare(1, 10_000), '<0.1%');
  });

  test('no total gives no share', () => {
    assert.equal(formatShare(5, 0), '');
    assert.equal(formatShare(0n, 0n), '');
  });
});
