import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { COLOR_THEMES } from '../src/theme/colorThemes';
import {
  assignChartColors,
  buildThemeChartPalette,
  chartPaletteTail,
  resolveStoredColor,
} from '../src/utils/pocketChartColors';

function linear(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = linear(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE76 colour difference; around 20 and more is easy to tell apart in a small swatch. */
function deltaE(a: string, b: string): number {
  const lab = (h: string) => {
    const [r, g, bl] = linear(h);
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}

describe('chart palette', () => {
  for (const [id, variants] of Object.entries(COLOR_THEMES)) {
    for (const [mode, colors] of Object.entries(variants)) {
      const palette = buildThemeChartPalette(colors, mode === 'dark');

      test(`${id} ${mode}: every colour reaches 3:1 on the surfaces`, () => {
        assert.equal(palette.length, 8);
        for (const hex of palette) {
          for (const surface of [colors.bg, colors.surface, colors.surfaceMuted]) {
            const ratio = contrast(hex, surface);
            assert.ok(ratio >= 3, `${hex} on ${surface} is ${ratio.toFixed(2)}:1`);
          }
        }
      });

      test(`${id} ${mode}: the accent is not mistaken for another hue`, () => {
        for (const hex of palette.slice(1)) {
          const d = deltaE(palette[0]!, hex);
          assert.ok(d >= 12, `${palette[0]} and ${hex} differ by only ${d.toFixed(1)}`);
        }
      });
    }
  }

  for (const isDark of [false, true]) {
    test(`${isDark ? 'dark' : 'light'}: the fixed hues are apart from each other`, () => {
      const tail = chartPaletteTail(isDark);
      for (let i = 0; i < tail.length; i++) {
        for (let j = i + 1; j < tail.length; j++) {
          const d = deltaE(tail[i]!, tail[j]!);
          assert.ok(d >= 18, `${tail[i]} and ${tail[j]} differ by only ${d.toFixed(1)}`);
        }
      }
    });
  }
});

describe('assignChartColors', () => {
  const palette = buildThemeChartPalette(COLOR_THEMES.terracotta.light, false);

  test('no two of the first eight ids share a colour', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `pocket-${i}-${'x'.repeat(i)}`);
    const colors = assignChartColors(ids, palette);
    assert.equal(new Set(colors.values()).size, 8);
  });

  test('does not depend on the order of the ids', () => {
    const ids = ['a1', 'b2', 'c3', 'd4'];
    const forward = assignChartColors(ids, palette);
    const backward = assignChartColors([...ids].reverse(), palette);
    for (const id of ids) assert.equal(forward.get(id), backward.get(id));
  });

  test('more ids than colours still gets a colour for each', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);
    const colors = assignChartColors(ids, palette);
    assert.equal(colors.size, 12);
    for (const hex of colors.values()) assert.ok(palette.includes(hex));
  });
});

describe('resolveStoredColor', () => {
  const light = buildThemeChartPalette(COLOR_THEMES.ocean.light, false);
  const dark = buildThemeChartPalette(COLOR_THEMES.ocean.dark, true);

  test('a colour picked on the light theme is the same slot on the dark theme', () => {
    assert.equal(resolveStoredColor(light[3], dark), dark[3]);
  });

  test('a colour the old palette offered resolves to the same slot', () => {
    assert.equal(resolveStoredColor('#354056', dark), dark[5]);
    assert.equal(resolveStoredColor('#7ec8cb', light), light[1]);
  });

  test('a hue that left the fixed set resolves to its replacement', () => {
    assert.equal(resolveStoredColor('#b0bec5', light), light[7]);
  });

  test('any accent follows the current accent', () => {
    assert.equal(resolveStoredColor(COLOR_THEMES.terracotta.light.primary, dark), dark[0]);
  });

  test('empty stays empty and unknown colours are kept', () => {
    assert.equal(resolveStoredColor(null, light), undefined);
    assert.equal(resolveStoredColor('#123456', light), '#123456');
  });
});
