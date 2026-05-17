import type { AppColors } from './palette';

/** Persisted accent / palette family (light + dark variants are derived per id). */
export type ColorThemeId = 'terracotta' | 'ocean' | 'forest' | 'slate' | 'red' | 'yellow';

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'terracotta';

export const COLOR_THEME_ORDER: ColorThemeId[] = [
  'terracotta',
  'ocean',
  'forest',
  'slate',
  'red',
  'yellow',
];

export const COLOR_THEME_META: Record<ColorThemeId, { title: string; subtitle: string }> = {
  terracotta: { title: 'Orange', subtitle: 'Warm orange accent' },
  ocean: { title: 'Ocean', subtitle: 'Cool teal' },
  forest: { title: 'Forest', subtitle: 'Fresh green' },
  slate: { title: 'Slate', subtitle: 'Blue-gray' },
  red: { title: 'Red', subtitle: 'Bold red accent' },
  yellow: { title: 'Yellow', subtitle: 'Deep gold (readable on buttons)' },
};

const terracottaLight: AppColors = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  border: '#e8e8e8',
  borderStrong: '#d0d0d0',
  text: '#111111',
  textSecondary: '#333333',
  textMuted: '#666666',
  /** Truer orange (less brick/red) while still readable with white labels. */
  primary: '#d45a12',
  onPrimary: '#ffffff',
  danger: '#b00020',
  success: '#2e7d32',
  chipBg: '#fff3e8',
  chipText: '#d45a12',
  jarSoftBg: '#fff8f2',
  jarSoftBorder: '#f5d4bc',
  jarHint: '#a34a0f',
  jarTitle: '#1a1a1a',
  jarBannerTitle: '#b84e10',
  archivedBg: '#f4f4f5',
  archivedBorder: '#d4d4d8',
  archivedTitle: '#52525b',
  archivedSub: '#71717a',
  inputBg: '#fafafa',
  inputBorder: '#dddddd',
  inputText: '#111111',
  modalOverlay: 'rgba(0,0,0,0.4)',
  placeholder: '#aaaaaa',
  shadowJar: '#d45a12',
  barTrack: '#eeeeee',
  switchTrackOff: '#dddddd',
  switchTrackOn: '#f0b896',
  switchThumbOff: '#f4f4f4',
  switchThumbOn: '#d45a12',
  pillBg: '#e8e8e8',
  pillText: '#333333',
  pocketPickBg: '#f4f4f4',
  pocketPickBgSelected: '#fff3e8',
  pocketPickBorder: '#e0e0e0',
  pocketPickBorderSelected: '#d45a12',
  pocketPickText: '#111111',
  pocketPickTextSelected: '#d45a12',
};

const terracottaDark: AppColors = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceMuted: '#1a1a1a',
  border: '#2a2a2a',
  borderStrong: '#3a3a3a',
  text: '#f0f0f0',
  textSecondary: '#d0d0d0',
  textMuted: '#909090',
  primary: '#e8702e',
  onPrimary: '#ffffff',
  danger: '#ff8a80',
  success: '#81c784',
  chipBg: '#2c1e12',
  chipText: '#f0a070',
  jarSoftBg: '#221810',
  jarSoftBorder: '#4d3828',
  jarHint: '#d4a080',
  jarTitle: '#f5f5f5',
  jarBannerTitle: '#f0a070',
  archivedBg: '#1c1c1e',
  archivedBorder: '#3f3f46',
  archivedTitle: '#a1a1aa',
  archivedSub: '#71717a',
  inputBg: '#1c1c1c',
  inputBorder: '#3a3a3a',
  inputText: '#f0f0f0',
  modalOverlay: 'rgba(0,0,0,0.65)',
  placeholder: '#777777',
  shadowJar: '#e8702e',
  barTrack: '#2a2a2a',
  switchTrackOff: '#444444',
  switchTrackOn: '#5c4028',
  switchThumbOff: '#888888',
  switchThumbOn: '#e8702e',
  pillBg: '#2a2a2a',
  pillText: '#cccccc',
  pocketPickBg: '#101010',
  pocketPickBgSelected: '#1c1c1e',
  pocketPickBorder: '#333333',
  pocketPickBorderSelected: '#e8702e',
  pocketPickText: '#ececec',
  pocketPickTextSelected: '#f0a070',
};

function pickLight(base: AppColors, p: Partial<AppColors>): AppColors {
  return { ...base, ...p };
}

function pickDark(base: AppColors, p: Partial<AppColors>): AppColors {
  return { ...base, ...p };
}

const oceanLight = pickLight(terracottaLight, {
  primary: '#0f5f60',
  chipBg: '#e6f4f4',
  chipText: '#0f5f60',
  jarSoftBg: '#f0f9f9',
  jarSoftBorder: '#c2e2e3',
  jarHint: '#0a4a4b',
  jarBannerTitle: '#0d5658',
  shadowJar: '#0f5f60',
  switchTrackOn: '#8cccd0',
  switchThumbOn: '#0f5f60',
  pocketPickBorderSelected: '#0f5f60',
  pocketPickTextSelected: '#4a9fa0',
});

const oceanDark = pickDark(terracottaDark, {
  primary: '#3cb0b3',
  chipBg: '#0f2324',
  chipText: '#8ddbdb',
  jarSoftBg: '#0f1c1d',
  jarSoftBorder: '#2a4a4c',
  jarHint: '#7ec8cb',
  jarBannerTitle: '#8ddbdb',
  shadowJar: '#3cb0b3',
  switchTrackOn: '#1e4a4d',
  switchThumbOn: '#3cb0b3',
  pocketPickBorderSelected: '#3cb0b3',
  pocketPickTextSelected: '#8ddbdb',
});

const forestLight = pickLight(terracottaLight, {
  primary: '#2f8f4a',
  chipBg: '#ecf8ef',
  chipText: '#2f8f4a',
  jarSoftBg: '#f0faf3',
  jarSoftBorder: '#b8e6c8',
  jarHint: '#1e6b34',
  jarBannerTitle: '#268040',
  shadowJar: '#2f8f4a',
  switchTrackOn: '#a8e0b8',
  switchThumbOn: '#2f8f4a',
  pocketPickBorderSelected: '#2f8f4a',
  pocketPickTextSelected: '#5ccc7a',
});

const forestDark = pickDark(terracottaDark, {
  primary: '#62d47a',
  chipBg: '#102818',
  chipText: '#a8f0b8',
  jarSoftBg: '#0c2214',
  jarSoftBorder: '#285536',
  jarHint: '#8ee0a0',
  jarBannerTitle: '#a8f0b8',
  shadowJar: '#62d47a',
  switchTrackOn: '#245530',
  switchThumbOn: '#62d47a',
  pocketPickBorderSelected: '#62d47a',
  pocketPickTextSelected: '#a8f0b8',
});

const slateLight = pickLight(terracottaLight, {
  primary: '#3d4a63',
  chipBg: '#f0f2f7',
  chipText: '#3d4a63',
  jarSoftBg: '#f4f5f9',
  jarSoftBorder: '#d4d9e5',
  jarHint: '#2d364a',
  jarBannerTitle: '#354056',
  shadowJar: '#3d4a63',
  switchTrackOn: '#a8b3cc',
  switchThumbOn: '#3d4a63',
  pocketPickBorderSelected: '#3d4a63',
  pocketPickTextSelected: '#6b7c9e',
});

const slateDark = pickDark(terracottaDark, {
  primary: '#7c90b8',
  chipBg: '#161a24',
  chipText: '#b4c4e0',
  jarSoftBg: '#12151e',
  jarSoftBorder: '#303848',
  jarHint: '#a0aec9',
  jarBannerTitle: '#b4c4e0',
  shadowJar: '#7c90b8',
  switchTrackOn: '#303a4d',
  switchThumbOn: '#7c90b8',
  pocketPickBorderSelected: '#7c90b8',
  pocketPickTextSelected: '#b4c4e0',
});

/** Deep red: strong contrast with white onPrimary. */
const redLight = pickLight(terracottaLight, {
  primary: '#b71d1d',
  chipBg: '#ffebee',
  chipText: '#b71d1d',
  jarSoftBg: '#fff5f5',
  jarSoftBorder: '#f5c4c4',
  jarHint: '#8b1515',
  jarBannerTitle: '#a31818',
  shadowJar: '#b71d1d',
  switchTrackOn: '#f0a8a8',
  switchThumbOn: '#b71d1d',
  pocketPickBorderSelected: '#b71d1d',
  pocketPickTextSelected: '#e87070',
});

const redDark = pickDark(terracottaDark, {
  primary: '#f05548',
  chipBg: '#2a1210',
  chipText: '#ffab9e',
  jarSoftBg: '#221010',
  jarSoftBorder: '#4d2828',
  jarHint: '#e89890',
  jarBannerTitle: '#ffab9e',
  shadowJar: '#f05548',
  switchTrackOn: '#5c2828',
  switchThumbOn: '#f05548',
  pocketPickBorderSelected: '#f05548',
  pocketPickTextSelected: '#ffab9e',
});

/**
 * “Yellow” palette: deep gold/amber fills so white button text stays readable (pure yellow fails WCAG).
 */
const yellowLight = pickLight(terracottaLight, {
  primary: '#b8890a',
  chipBg: '#fffbeb',
  chipText: '#b8890a',
  jarSoftBg: '#fffbf0',
  jarSoftBorder: '#f0e0a8',
  jarHint: '#8a6808',
  jarBannerTitle: '#9a7409',
  shadowJar: '#b8890a',
  switchTrackOn: '#e8d078',
  switchThumbOn: '#b8890a',
  pocketPickBorderSelected: '#b8890a',
  pocketPickTextSelected: '#d4b040',
});

const yellowDark = pickDark(terracottaDark, {
  primary: '#e8b020',
  chipBg: '#2a2410',
  chipText: '#f5d878',
  jarSoftBg: '#221c0c',
  jarSoftBorder: '#4d4428',
  jarHint: '#e0c860',
  jarBannerTitle: '#f5d878',
  shadowJar: '#e8b020',
  switchTrackOn: '#5c5020',
  switchThumbOn: '#e8b020',
  pocketPickBorderSelected: '#e8b020',
  pocketPickTextSelected: '#f5d878',
});

export const COLOR_THEMES: Record<ColorThemeId, { light: AppColors; dark: AppColors }> = {
  terracotta: { light: terracottaLight, dark: terracottaDark },
  ocean: { light: oceanLight, dark: oceanDark },
  forest: { light: forestLight, dark: forestDark },
  slate: { light: slateLight, dark: slateDark },
  red: { light: redLight, dark: redDark },
  yellow: { light: yellowLight, dark: yellowDark },
};

export function normalizeColorThemeId(raw: string | null | undefined): ColorThemeId {
  if (
    raw === 'ocean' ||
    raw === 'forest' ||
    raw === 'slate' ||
    raw === 'terracotta' ||
    raw === 'red' ||
    raw === 'yellow'
  ) {
    return raw;
  }
  return DEFAULT_COLOR_THEME_ID;
}
