import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { COLOR_THEMES } from '../src/theme/colorThemes';
import type { AppColors } from '../src/theme/palette';

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text token on the background it is drawn on (WCAG 2.2 AA, normal text). */
const PAIRS: [keyof AppColors, keyof AppColors][] = [
  ['onPrimary', 'primary'],
  ['primary', 'surface'],
  ['chipText', 'chipBg'],
  ['pocketPickTextSelected', 'pocketPickBgSelected'],
  ['placeholder', 'inputBg'],
  ['jarHint', 'jarSoftBg'],
  ['jarBannerTitle', 'jarSoftBg'],
];

describe('palette contrast', () => {
  for (const [id, variants] of Object.entries(COLOR_THEMES)) {
    for (const [mode, colors] of Object.entries(variants)) {
      test(`${id} ${mode}: text tokens reach 4.5:1`, () => {
        for (const [fg, bg] of PAIRS) {
          const ratio = contrast(colors[fg], colors[bg]);
          assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
        }
      });
    }
  }
});
