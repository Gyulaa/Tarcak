/**
 * Semantic colors for light and dark UI. Screens use tokens from `useAppTheme()`, not raw hex.
 * Accent families live in `colorThemes.ts` (`COLOR_THEMES`).
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
