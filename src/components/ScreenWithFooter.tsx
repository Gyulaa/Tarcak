// @ts-nocheck
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeContext';
import { DonationFooter } from './DonationFooter';

/**
 * Standard screen shell: main content (flex) + support footer on every page.
 */
export function ScreenWithFooter({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.main}>{children}</View>
      <DonationFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  main: { flex: 1 },
});
