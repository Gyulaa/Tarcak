/**
 * UI appearance cached in SecureStore so the vault gate can match the user's theme
 * before the encrypted database is unlocked. Not secret — only dark mode + accent id.
 */
import * as SecureStore from 'expo-secure-store';

import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME_ID,
  normalizeColorThemeId,
  type ColorThemeId,
} from './colorThemes';
import type { AppColors } from './palette';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

const KEYS = {
  dark: 'tarcak_ui_dark_theme',
  colorTheme: 'tarcak_ui_color_theme_id',
} as const;

export type AppearanceCache = {
  isDark: boolean;
  colorThemeId: ColorThemeId;
};

export function resolveAppearanceColors(cache: AppearanceCache): AppColors {
  const pack = COLOR_THEMES[cache.colorThemeId] ?? COLOR_THEMES[DEFAULT_COLOR_THEME_ID];
  return cache.isDark ? pack.dark : pack.light;
}

export async function readAppearanceCache(): Promise<AppearanceCache> {
  const [darkRaw, themeRaw] = await Promise.all([
    SecureStore.getItemAsync(KEYS.dark, OPTIONS),
    SecureStore.getItemAsync(KEYS.colorTheme, OPTIONS),
  ]);
  return {
    isDark: darkRaw === null ? true : darkRaw === '1',
    colorThemeId: normalizeColorThemeId(themeRaw),
  };
}

export async function writeAppearanceCache(cache: AppearanceCache): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.dark, cache.isDark ? '1' : '0', OPTIONS),
    SecureStore.setItemAsync(KEYS.colorTheme, cache.colorThemeId, OPTIONS),
  ]);
}
