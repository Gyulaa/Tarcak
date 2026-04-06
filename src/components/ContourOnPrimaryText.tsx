// @ts-nocheck
import type { ReactNode } from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';

import { font } from '../theme/fonts';
import { useAppTheme } from '../theme/ThemeContext';

type Props = {
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

/**
 * Label text on primary (filled) controls: white on a deep terracotta, **bold** for legibility.
 * Pass `style` with another `fontFamily` if a control needs a different weight.
 */
export function ContourOnPrimaryText({ style, children }: Props) {
  const { colors } = useAppTheme();
  const fontPad = Platform.OS === 'android' ? ({ includeFontPadding: false } as const) : {};
  return (
    <Text style={[style, { fontFamily: font.bold, color: colors.onPrimary }, fontPad]}>
      {children}
    </Text>
  );
}
