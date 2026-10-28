import type { ReactNode } from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';

import { font } from '../theme/fonts';
import { useAppTheme } from '../theme/ThemeContext';

type Props = {
  style?: StyleProp<TextStyle>;
  /** A glyph that only decorates the control (a "+"): left out of what a screen reader reads. */
  decorative?: boolean;
  children: ReactNode;
};

/**
 * Label text on primary (filled) controls: white on a deep terracotta, **bold** for legibility.
 * Pass `style` with another `fontFamily` if a control needs a different weight.
 */
export function ContourOnPrimaryText({ style, decorative, children }: Props) {
  const { colors } = useAppTheme();
  const fontPad = Platform.OS === 'android' ? ({ includeFontPadding: false } as const) : {};
  return (
    <Text
      style={[style, { fontFamily: font.bold, color: colors.onPrimary }, fontPad]}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    >
      {children}
    </Text>
  );
}
