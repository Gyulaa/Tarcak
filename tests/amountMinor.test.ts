import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  autoDisplayDecimals,
  formatMinorRounded,
  formatMinorToAmountString,
  parseAmountStringToMinor,
} from '../src/utils/amountMinor';

const ONE = 100_000_000;

describe('parseAmountStringToMinor', () => {
  test('a point or a comma both mark the decimals', () => {
    assert.equal(parseAmountStringToMinor('12.5'), 12.5 * ONE);
    assert.equal(parseAmountStringToMinor('12,5'), 12.5 * ONE);
    assert.equal(parseAmountStringToMinor('0,00000001'), 1);
    assert.equal(parseAmountStringToMinor(',5'), ONE / 2);
    assert.equal(parseAmountStringToMinor('3,'), 3 * ONE);
  });

  test('spaces group digits', () => {
    assert.equal(parseAmountStringToMinor(' 1 234 567,89 '), 123_456_789 * 1_000_000);
    assert.equal(parseAmountStringToMinor('1\u00a0000'), 1000 * ONE);
  });

  test('signs', () => {
    assert.equal(parseAmountStringToMinor('-2,25'), -2.25 * ONE);
    assert.equal(parseAmountStringToMinor('+7'), 7 * ONE);
  });

  test('more than one separator is rejected instead of guessed', () => {
    assert.throws(() => parseAmountStringToMinor('1,000.50'), /one decimal separator/);
    assert.throws(() => parseAmountStringToMinor('1.000.000'), /one decimal separator/);
    assert.throws(() => parseAmountStringToMinor('1,000,000'), /one decimal separator/);
  });

  test('invalid, empty and zero input', () => {
    assert.throws(() => parseAmountStringToMinor(''), /Enter an amount/);
    assert.throws(() => parseAmountStringToMinor('-'), /Enter an amount/);
    assert.throws(() => parseAmountStringToMinor(','), /Enter an amount/);
    assert.throws(() => parseAmountStringToMinor('12a'), /digits/);
    assert.throws(() => parseAmountStringToMinor('0,0'), /not be zero/);
  });

  test('precision and range limits', () => {
    assert.throws(() => parseAmountStringToMinor('1,123456789'), /8 decimal/);
    assert.equal(parseAmountStringToMinor('90071992,54740991'), Number.MAX_SAFE_INTEGER);
    assert.throws(() => parseAmountStringToMinor('90071992,54740992'), /too large/);
  });
});

describe('formatMinorToAmountString', () => {
  test('round-trips through the parser', () => {
    for (const minor of [1, -1, ONE, 12.5 * ONE, -123_456_789, Number.MAX_SAFE_INTEGER]) {
      assert.equal(parseAmountStringToMinor(formatMinorToAmountString(minor)), minor);
    }
  });
});

describe('autoDisplayDecimals', () => {
  test('hundreds and up show whole units, 1–100 shows cents, below 1 three significant digits', () => {
    assert.equal(autoDisplayDecimals(1_234_567 * ONE), 0);
    assert.equal(autoDisplayDecimals(100 * ONE), 0);
    assert.equal(autoDisplayDecimals(-250 * ONE), 0);
    assert.equal(autoDisplayDecimals(99.99 * ONE), 2);
    assert.equal(autoDisplayDecimals(ONE), 2);
    assert.equal(autoDisplayDecimals(0.5 * ONE), 3);
    assert.equal(autoDisplayDecimals(12_345), 6); // 0.00012345
    assert.equal(autoDisplayDecimals(1), 8);
    assert.equal(autoDisplayDecimals(0), 0);
  });
});

describe('formatMinorRounded', () => {
  test('rounds half away from zero, carrying into the whole part', () => {
    assert.equal(formatMinorRounded(333_333_333_33, 0, false), '333');
    assert.equal(formatMinorRounded(250_000_000, 0, false), '3');
    assert.equal(formatMinorRounded(-250_000_000, 0, false), '-3');
    assert.equal(formatMinorRounded(99_960_000, 3, false), '1');
    assert.equal(formatMinorRounded(999_999_950_000_000, 0, false), '10 000 000');
  });

  test('keeps or drops trailing zeros', () => {
    assert.equal(formatMinorRounded(12.5 * ONE, 2, true), '12.50');
    assert.equal(formatMinorRounded(12.5 * ONE, 2, false), '12.5');
    assert.equal(formatMinorRounded(300 * ONE, 2, true), '300.00');
    assert.equal(formatMinorRounded(300 * ONE, 2, false), '300');
  });

  test('eight decimals is exact', () => {
    assert.equal(formatMinorRounded(123_456_789, 8, true), '1.23456789');
    assert.equal(formatMinorRounded(1, 8, false), '0.00000001');
  });

  test('no negative zero', () => {
    assert.equal(formatMinorRounded(-1, 2, false), '0');
    assert.equal(formatMinorRounded(-1, 2, true), '0.00');
  });

  test('rejects bad input', () => {
    assert.throws(() => formatMinorRounded(1.5, 2, false));
    assert.throws(() => formatMinorRounded(1, 9, false));
  });
});

describe('bigint amounts (balances beyond 2^53 minor)', () => {
  // 2^53 + 1 minor: the first value a float cannot hold
  const BEYOND = 9_007_199_254_740_993n;

  test('formatMinorRounded stays exact', () => {
    assert.equal(formatMinorRounded(BEYOND, 8, true), '90 071 992.54740993');
    assert.equal(formatMinorRounded(-BEYOND, 8, true), '-90 071 992.54740993');
    assert.equal(formatMinorRounded(BEYOND, 0, false), '90 071 993');
    assert.equal(formatMinorRounded(5n, 2, true), '0.00');
  });

  test('a bigint and a number of the same value format the same', () => {
    assert.equal(formatMinorRounded(12.5 * ONE, 2, true), formatMinorRounded(BigInt(12.5 * ONE), 2, true));
  });

  test('autoDisplayDecimals matches the number rules', () => {
    assert.equal(autoDisplayDecimals(BEYOND), 0);
    assert.equal(autoDisplayDecimals(-BEYOND), 0);
    assert.equal(autoDisplayDecimals(BigInt(ONE)), 2);
    assert.equal(autoDisplayDecimals(12_345n), 6);
    assert.equal(autoDisplayDecimals(0n), 0);
  });
});
