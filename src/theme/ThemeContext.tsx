import type { Theme } from '@react-navigation/native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as settingsRepo from '../db/repositories/settings';
import type { AppColors } from './palette';
import { darkColors, lightColors } from './palette';

export type AppThemeContextValue = {
  colors: AppColors;
  isDark: boolean;
  navTheme: Theme;
  setDarkMode: (enabled: boolean) => Promise<void>;
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

  useEffect(() => {
    void settingsRepo.getDarkThemeEnabled().then(setIsDark);
  }, []);

  const colors = isDark ? darkColors : lightColors;

  const setDarkMode = useCallback(async (enabled: boolean) => {
    setIsDark(enabled);
    await settingsRepo.setDarkThemeEnabled(enabled);
  }, []);

  const navTheme = useMemo(() => buildNavTheme(colors, isDark), [colors, isDark]);

  const value = useMemo(
    () => ({
      colors,
      isDark,
      navTheme,
      setDarkMode,
    }),
    [colors, isDark, navTheme, setDarkMode]
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
