import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export type DonutSlice = {
  key: string;
  name: string;
  color: string;
  /** Proportion only; the amount and share are shown as the texts below. */
  value: number;
  amountText: string;
  shareText: string;
};

type Props = {
  slices: DonutSlice[];
  centerText: string;
  centerSub: string;
};

/** A donut with its legend. The legend carries name, share and amount as text, so the ring is decoration for screen readers. */
export function DonutChart({ slices, centerText, centerSub }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const data = useMemo(
    () => slices.map((s) => ({ value: s.value, color: s.color, text: s.name })),
    [slices]
  );

  return (
    <>
      <View
        style={styles.pieWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <PieChart
          data={data}
          donut
          showText={false}
          innerRadius={58}
          radius={96}
          innerCircleColor={colors.surface}
          centerLabelComponent={() => (
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterLabel} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {centerText}
              </Text>
              <Text style={styles.pieCenterSub} maxFontSizeMultiplier={1.2}>
                {centerSub}
              </Text>
            </View>
          )}
        />
      </View>
      <View style={styles.legend}>
        {slices.map((s) => (
          <View
            key={s.key}
            style={styles.legendRow}
            accessible
            accessibilityLabel={`${s.name}, ${s.amountText}${s.shareText ? `, ${s.shareText}` : ''}`}
          >
            <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={styles.legendShare}>{s.shareText}</Text>
            <Text style={styles.legendAmt}>{s.amountText}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    pieWrap: { alignItems: 'center', marginVertical: 8 },
    pieCenter: { alignItems: 'center', justifyContent: 'center', maxWidth: 88 },
    pieCenterLabel: { fontSize: 12, fontFamily: font.bold, color: c.text, textAlign: 'center' },
    pieCenterSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    legend: { marginTop: 12, gap: 8 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    legendSwatch: { width: 12, height: 12, borderRadius: 4 },
    legendName: { flex: 1, fontSize: 14, color: c.textSecondary },
    legendShare: { fontSize: 13, color: c.textMuted, minWidth: 52, textAlign: 'right' },
    legendAmt: { fontSize: 13, color: c.textMuted, fontFamily: font.semibold },
  });
}
