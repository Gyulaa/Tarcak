import type { Theme } from '@react-navigation/native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as settingsRepo from '../db/repositories/settings';
import type { AppColors } from './palette';
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME_ID,
  normalizeColorThemeId,
  type ColorThemeId,
} from './colorThemes';

export type AppThemeContextValue = {
  colors: AppColors;
  isDark: boolean;
  colorThemeId: ColorThemeId;
  navTheme: Theme;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setColorTheme: (id: ColorThemeId) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function buildNavTheme(colors: AppColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [colorThemeId, setColorThemeIdState] = useState<ColorThemeId>(DEFAULT_COLOR_THEME_ID);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [dark, rawTheme] = await Promise.all([
        settingsRepo.getDarkThemeEnabled(),
        settingsRepo.getColorThemeId(),
      ]);
      if (cancelled) return;
      setIsDark(dark);
      setColorThemeIdState(normalizeColorThemeId(rawTheme));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const colors = useMemo(() => {
    const pack = COLOR_THEMES[colorThemeId] ?? COLOR_THEMES[DEFAULT_COLOR_THEME_ID];
    return isDark ? pack.dark : pack.light;
  }, [colorThemeId, isDark]);

  const setDarkMode = useCallback(async (enabled: boolean) => {
    setIsDark(enabled);
    await settingsRepo.setDarkThemeEnabled(enabled);
  }, []);

  const setColorTheme = useCallback(async (id: ColorThemeId) => {
    const next = normalizeColorThemeId(id);
    setColorThemeIdState(next);
    await settingsRepo.setColorThemeId(next);
  }, []);

  const navTheme = useMemo(() => buildNavTheme(colors, isDark), [colors, isDark]);

  const value = useMemo(
    () => ({
      colors,
      isDark,
      colorThemeId,
      navTheme,
      setDarkMode,
      setColorTheme,
    }),
    [colors, isDark, colorThemeId, navTheme, setDarkMode, setColorTheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}
