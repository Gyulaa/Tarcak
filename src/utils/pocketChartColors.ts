import type { AppColors } from '../theme/palette';

/** Fallback when theme palette is unavailable. */
const FALLBACK_PALETTE = [
  '#d45a12',
  '#0f5f60',
  '#2f8f4a',
  '#3d4a63',
  '#b71d1d',
  '#b8890a',
  '#5c6bc0',
  '#8e6bbf',
] as const;

/** Eight hues that stay legible on light and dark surfaces. */
export function buildThemeChartPalette(c: AppColors, isDark: boolean): string[] {
  if (isDark) {
    return [
      c.primary,
      '#7ec8cb',
      '#a8f0b8',
      '#ffb4a8',
      '#f5d878',
      '#b4c4e0',
      '#c9a0ff',
      '#e89890',
    ];
  }
  return [
    c.primary,
    '#0d5658',
    '#268040',
    '#a31818',
    '#9a7409',
    '#354056',
    '#5c6bc0',
    '#7a5cad',
  ];
}

function hashPocketId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pocketChartColor(pocketId: string, palette: string[] = [...FALLBACK_PALETTE]): string {
  if (palette.length === 0) return FALLBACK_PALETTE[0];
  const idx = hashPocketId(pocketId) % palette.length;
  return palette[idx]!;
}

export function pocketChartPalette(): readonly string[] {
  return FALLBACK_PALETTE;
}
