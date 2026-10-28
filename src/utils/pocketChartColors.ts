import { COLOR_THEMES } from '../theme/colorThemes';
import type { AppColors } from '../theme/palette';

/**
 * The one chart palette: the theme's accent first, then seven fixed hues. Every entry reaches 3:1
 * (WCAG 1.4.11, graphical objects) on the app surfaces in its own variant, and the hues stay
 * apart from each other; `tests/chartColors.test.ts` guards both.
 */
const TAIL_LIGHT = ['#1565c0', '#667a00', '#7b3fa0', '#00838f', '#ad1457', '#a85f00', '#546e7a'] as const;
const TAIL_DARK = ['#64b5f6', '#c5e063', '#ce93d8', '#4dd0e1', '#f48fb1', '#ffb74d', '#b0bec5'] as const;

/**
 * Colours the UI offered before the palette was unified (accent first, then seven hues). A category
 * stores its colour as a hex, so these still resolve to the matching slot of today's palette.
 */
const LEGACY_LIGHT = ['#0d5658', '#268040', '#a31818', '#9a7409', '#354056', '#5c6bc0', '#7a5cad'] as const;
const LEGACY_DARK = ['#7ec8cb', '#a8f0b8', '#ffb4a8', '#f5d878', '#b4c4e0', '#c9a0ff', '#e89890'] as const;

export function chartPaletteTail(isDark: boolean): readonly string[] {
  return isDark ? TAIL_DARK : TAIL_LIGHT;
}

/** Eight hues (index 0 is the theme accent) that stay legible on the surfaces of the given variant. */
export function buildThemeChartPalette(c: AppColors, isDark: boolean): string[] {
  return [c.primary, ...chartPaletteTail(isDark)];
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** A stable colour for one id; two ids can collide, so charts that show several use `assignChartColors`. */
export function pocketChartColor(id: string, palette: readonly string[]): string {
  return palette[hashId(id) % palette.length]!;
}

/**
 * Colours for the ids shown together in one chart: each id starts at its hash slot and moves to the
 * next free one, so no two of the first `palette.length` ids share a colour. The result depends on
 * the set of ids only, not on the order they come in.
 */
export function assignChartColors(ids: readonly string[], palette: readonly string[]): Map<string, string> {
  const taken = new Set<number>();
  const out = new Map<string, string>();
  for (const id of [...new Set(ids)].sort()) {
    let slot = hashId(id) % palette.length;
    if (taken.size < palette.length) {
      while (taken.has(slot)) slot = (slot + 1) % palette.length;
      taken.add(slot);
    }
    out.set(id, palette[slot]!);
  }
  return out;
}

const ACCENTS: ReadonlySet<string> = new Set(
  Object.values(COLOR_THEMES).flatMap((v) => [v.light.primary.toLowerCase(), v.dark.primary.toLowerCase()])
);

/**
 * The colour to draw for a stored category colour in the current theme. The picker only offers
 * palette slots, so a stored hex from any theme or variant maps to the same slot of the current
 * palette (a former accent follows the accent); anything else is drawn as stored.
 */
export function resolveStoredColor(stored: string | null | undefined, palette: readonly string[]): string | undefined {
  if (!stored) return undefined;
  const hex = stored.toLowerCase();
  if (ACCENTS.has(hex)) return palette[0];
  for (const list of [TAIL_LIGHT, TAIL_DARK, LEGACY_LIGHT, LEGACY_DARK] as readonly (readonly string[])[]) {
    const i = list.indexOf(hex);
    if (i >= 0) return palette[i + 1];
  }
  return stored;
}

/** Whether a stored colour is the one the swatch row shows as selected (any variant of the same slot). */
export function isSameChartSlot(stored: string | null | undefined, swatch: string, palette: readonly string[]): boolean {
  return resolveStoredColor(stored, palette) === swatch;
}
