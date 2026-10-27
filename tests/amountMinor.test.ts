import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  formatMinorToAmountString,
  parseAmountStringToMinor,
} from '../src/utils/amountMinor.ts';

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
