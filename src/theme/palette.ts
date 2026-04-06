/**
 * Semantic colors for light and dark (black) UI. Screens should use these tokens, not raw hex.
 */
export type AppColors = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  success: string;
  chipBg: string;
  chipText: string;
  jarSoftBg: string;
  jarSoftBorder: string;
  jarHint: string;
  jarTitle: string;
  jarBannerTitle: string;
  archivedBg: string;
  archivedBorder: string;
  archivedTitle: string;
  archivedSub: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  modalOverlay: string;
  placeholder: string;
  shadowJar: string;
  barTrack: string;
  switchTrackOff: string;
  switchTrackOn: string;
  switchThumbOff: string;
  switchThumbOn: string;
  pillBg: string;
  pillText: string;
  /** Pocket name rows (transaction editor, add-pocket modals): dark tile + light label */
  pocketPickBg: string;
  pocketPickBgSelected: string;
  pocketPickBorder: string;
  pocketPickBorderSelected: string;
  pocketPickText: string;
  pocketPickTextSelected: string;
};

export const lightColors: AppColors = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  border: '#e8e8e8',
  borderStrong: '#d0d0d0',
  text: '#111111',
  textSecondary: '#333333',
  textMuted: '#666666',
  /** Deep rust terracotta: strong contrast with white bold labels on filled buttons. */
  primary: '#9a3f1f',
  onPrimary: '#ffffff',
  danger: '#b00020',
  success: '#2e7d32',
  chipBg: '#faf2ef',
  chipText: '#9a3f1f',
  jarSoftBg: '#faf6f4',
  jarSoftBorder: '#e5d0c8',
  jarHint: '#6d3018',
  jarTitle: '#1a1a1a',
  jarBannerTitle: '#8b3a1e',
  archivedBg: '#f4f4f5',
  archivedBorder: '#d4d4d8',
  archivedTitle: '#52525b',
  archivedSub: '#71717a',
  inputBg: '#fafafa',
  inputBorder: '#dddddd',
  inputText: '#111111',
  modalOverlay: 'rgba(0,0,0,0.4)',
  placeholder: '#aaaaaa',
  shadowJar: '#9a3f1f',
  barTrack: '#eeeeee',
  switchTrackOff: '#dddddd',
  switchTrackOn: '#cf9e8c',
  switchThumbOff: '#f4f4f4',
  switchThumbOn: '#9a3f1f',
  pillBg: '#e8e8e8',
  pillText: '#333333',
  pocketPickBg: '#1c1c1e',
  pocketPickBgSelected: '#2d2d32',
  pocketPickBorder: '#3a3a3e',
  pocketPickBorderSelected: '#9a3f1f',
  pocketPickText: '#e8e8ed',
  pocketPickTextSelected: '#d4876a',
};

/** Near-black theme */
export const darkColors: AppColors = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceMuted: '#1a1a1a',
  border: '#2a2a2a',
  borderStrong: '#3a3a3a',
  text: '#f0f0f0',
  textSecondary: '#d0d0d0',
  textMuted: '#909090',
  /** Burnt orange: a step deeper than before; still lifts off near-black. Same hue as light theme. */
  primary: '#c25832',
  onPrimary: '#ffffff',
  danger: '#ff8a80',
  success: '#81c784',
  chipBg: '#2a1a14',
  chipText: '#e8a584',
  jarSoftBg: '#1f1512',
  jarSoftBorder: '#4a3328',
  jarHint: '#c49a88',
  jarTitle: '#f5f5f5',
  jarBannerTitle: '#e8a584',
  archivedBg: '#1c1c1e',
  archivedBorder: '#3f3f46',
  archivedTitle: '#a1a1aa',
  archivedSub: '#71717a',
  inputBg: '#1c1c1c',
  inputBorder: '#3a3a3a',
  inputText: '#f0f0f0',
  modalOverlay: 'rgba(0,0,0,0.65)',
  placeholder: '#777777',
  shadowJar: '#c25832',
  barTrack: '#2a2a2a',
  switchTrackOff: '#444444',
  switchTrackOn: '#523428',
  switchThumbOff: '#888888',
  switchThumbOn: '#c25832',
  pillBg: '#2a2a2a',
  pillText: '#cccccc',
  pocketPickBg: '#101010',
  pocketPickBgSelected: '#1c1c1e',
  pocketPickBorder: '#333333',
  pocketPickBorderSelected: '#c25832',
  pocketPickText: '#ececec',
  pocketPickTextSelected: '#e8a584',
};
