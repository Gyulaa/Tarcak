// @ts-nocheck
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/fonts';
import type { AppColors } from '../../theme/palette';
import type { SplitRow } from '../../domain/jarAdvancedEditorTypes';
import { formatMinorForDisplay } from '../../utils/formatMinor';
import { buildThemeChartPalette, pocketChartColor } from '../../utils/pocketChartColors';

type Props = {
  caption: string;
  rows: SplitRow[];
  /** When `amount`, legend shows each pocket's share of `amountBaseMinor`. */
  legendFormat?: 'percent' | 'amount';
  amountBaseMinor?: number;
  currency?: string;
};

function formatLegendValue(
  row: SplitRow,
  legendFormat: 'percent' | 'amount',
  amountBaseMinor: number | undefined,
  currency: string | undefined
): string {
  if (legendFormat === 'amount' && amountBaseMinor != null && currency) {
    const shareMinor = Math.round((amountBaseMinor * row.percent) / 100);
    return formatMinorForDisplay(shareMinor, currency);
  }
  return `${row.percent.toFixed(1)}%`;
}

export function JarAdvancedSplitBar({
  caption,
  rows,
  legendFormat = 'percent',
  amountBaseMinor,
  currency,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const palette = useMemo(() => buildThemeChartPalette(colors, isDark), [colors, isDark]);

  const validRows = rows.filter((r) => r.percent > 0.001);

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.barTrack}>
        {validRows.map((r) => (
          <View
            key={r.pocketId}
            style={[
              styles.segment,
              {
                flex: r.percent,
                backgroundColor: pocketChartColor(r.pocketId, palette),
              },
            ]}
          />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
        <View style={styles.legendRow}>
          {validRows.map((r) => (
            <View key={r.pocketId} style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: pocketChartColor(r.pocketId, palette) }]}
              />
              <Text style={styles.legendText} numberOfLines={1}>
                {r.name} {formatLegendValue(r, legendFormat, amountBaseMinor, currency)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    caption: {
      fontFamily: font.semibold,
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 10,
    },
    barTrack: {
      flexDirection: 'row',
      height: 22,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: c.border,
    },
    segment: { minWidth: 2, height: '100%' },
    legendScroll: { marginTop: 10 },
    legendRow: { flexDirection: 'row', gap: 14, paddingRight: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 160 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 13, color: c.textMuted },
  });
}
