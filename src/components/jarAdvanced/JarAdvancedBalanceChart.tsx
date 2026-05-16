// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Polyline, Rect } from 'react-native-svg';

import {
  axisTickBalances,
  balanceToXInPlot,
  buildChartLayout,
  buildChartPlotArea,
  buildPocketLineSeries,
  percentToYInPlot,
  snapPreviewBalance,
  xToBalanceInPlot,
  Y_AXIS_TICK_PERCENTS,
  type ChartPlotArea,
  type PocketLineSeries,
} from '../../domain/jarAdvancedChartModel';
import type { EditorKnotId, EditorMilestone, SplitRow } from '../../domain/jarAdvancedEditorTypes';
import { useAppTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/fonts';
import type { AppColors } from '../../theme/palette';
import { formatMinorForDisplay } from '../../utils/formatMinor';
import { buildThemeChartPalette, pocketChartColor } from '../../utils/pocketChartColors';

const CHART_HEIGHT = 248;
const LEGEND_ROW_HEIGHT = 28;
const KNOT_HIT = 40;

type Props = {
  currency: string;
  defaultCeilingMinor: number;
  defaultSplits: SplitRow[];
  milestones: EditorMilestone[];
  pocketNames: Map<string, string>;
  selectedKnotId: EditorKnotId | null;
  previewBalanceMinor: number | null;
  onSelectKnot: (knotId: EditorKnotId) => void;
  onPreviewBalance: (balanceMinor: number) => void;
  onAddMilestone: () => void;
};

export function JarAdvancedBalanceChart({
  currency,
  defaultCeilingMinor,
  defaultSplits,
  milestones,
  pocketNames,
  selectedKnotId,
  previewBalanceMinor,
  onSelectKnot,
  onPreviewBalance,
  onAddMilestone,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const palette = useMemo(() => buildThemeChartPalette(colors, isDark), [colors, isDark]);
  const [chartWidth, setChartWidth] = useState(320);

  const editorState = useMemo(
    () => ({ defaultCeilingMinor, defaultSplits, milestones }),
    [defaultCeilingMinor, defaultSplits, milestones]
  );

  const layout = useMemo(
    () => buildChartLayout(editorState, chartWidth),
    [editorState, chartWidth]
  );

  const plot = useMemo(() => buildChartPlotArea(layout, CHART_HEIGHT), [layout]);

  const lineSeries = useMemo(
    () =>
      buildPocketLineSeries(editorState, layout, pocketNames, 56).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [editorState, layout, pocketNames]
  );

  const selectedKnot = useMemo(() => {
    if (!selectedKnotId) return null;
    const id = selectedKnotId === 'default' ? 'default' : selectedKnotId;
    return layout.knots.find((k) => k.id === id) ?? null;
  }, [layout.knots, selectedKnotId]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  }, []);

  const scrubX =
    previewBalanceMinor != null ? balanceToXInPlot(previewBalanceMinor, plot) : null;

  const ticks = useMemo(() => axisTickBalances(layout.maxMinor, 4), [layout.maxMinor]);
  const axisY = plot.top + plot.height;

  const scrubBalance = useCallback(
    (x: number) => {
      const bal = snapPreviewBalance(xToBalanceInPlot(x, plot), layout.maxMinor);
      onPreviewBalance(bal);
    },
    [layout.maxMinor, onPreviewBalance, plot]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          const x = Math.max(plot.left, Math.min(plot.left + plot.width, e.x));
          scrubBalance(x);
        })
        .onEnd((e) => {
          const x = Math.max(plot.left, Math.min(plot.left + plot.width, e.x));
          scrubBalance(x);
        }),
    [plot, scrubBalance]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        scrubBalance(e.x);
      }),
    [scrubBalance]
  );

  const plotGesture = Gesture.Race(panGesture, tapGesture);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Balance Chart</Text>
        <Pressable style={styles.addBtn} onPress={onAddMilestone}>
          <Text style={styles.addBtnText}>+ Milestone</Text>
        </Pressable>
      </View>

      <View style={[styles.chartBox, { height: CHART_HEIGHT }]}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {renderPlotBackground(plot, colors)}
          {renderGrid(plot, ticks, colors)}
          {renderKnotGuides(layout, plot, selectedKnotId, colors)}
          {lineSeries.map((series) =>
            renderPocketLine(series, plot, palette, selectedKnot, colors)
          )}
          {scrubX != null ? (
            <Line
              x1={scrubX}
              y1={plot.top}
              x2={scrubX}
              y2={axisY}
              stroke={colors.primary}
              strokeWidth={2}
              strokeDasharray="5 4"
              opacity={0.9}
            />
          ) : null}
          {layout.knots
            .filter((k) => k.kind !== 'origin')
            .map((k) => renderKnotOnAxis(k, plot, selectedKnotId, colors))}
        </Svg>

        <View style={styles.yLabels} pointerEvents="none">
          {Y_AXIS_TICK_PERCENTS.map((pct) => (
            <Text
              key={pct}
              style={[
                styles.yLabel,
                { top: percentToYInPlot(pct, plot) - 7 },
              ]}
            >
              {pct}%
            </Text>
          ))}
        </View>

        <GestureDetector gesture={plotGesture}>
          <View
            style={[
              styles.plotTouch,
              {
                left: plot.left,
                width: plot.width,
                top: plot.top,
                height: plot.height,
              },
            ]}
          />
        </GestureDetector>

        {layout.knots
          .filter((k) => k.kind !== 'origin')
          .map((k) => {
            const x = balanceToXInPlot(k.balanceMinor, plot);
            const knotId = k.kind === 'ceiling' ? 'default' : k.id;
            const isSelected = selectedKnotId === knotId;
            return (
              <Pressable
                key={k.id}
                style={[
                  styles.knotHit,
                  {
                    left: x - KNOT_HIT / 2,
                    top: axisY - KNOT_HIT / 2,
                  },
                ]}
                onPress={() => onSelectKnot(knotId)}
                accessibilityLabel={k.kind === 'ceiling' ? 'Default ceiling' : k.label}
              >
                <View
                  style={[
                    styles.knotCore,
                    isSelected && styles.knotCoreSelected,
                    k.kind === 'ceiling' && styles.knotCeiling,
                  ]}
                />
              </Pressable>
            );
          })}

        <View
          style={[styles.tickLabels, { top: axisY + 6 }]}
          pointerEvents="none"
        >
          {ticks.map((t) => {
            const x = balanceToXInPlot(t, plot);
            return (
              <Text
                key={`lbl-${t}`}
                style={[styles.tickLabel, { left: x - 40, width: 80 }]}
                numberOfLines={1}
              >
                {formatMinorForDisplay(t, currency)}
              </Text>
            );
          })}
        </View>
      </View>

      {lineSeries.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendScroll}
          contentContainerStyle={styles.legendRow}
        >
          {lineSeries.map((s) => {
            const color = pocketChartColor(s.pocketId, palette);
            const active =
              selectedKnot != null &&
              selectedKnot.splits.some((r) => r.pocketId === s.pocketId && r.percent > 0);
            return (
              <View
                key={s.pocketId}
                style={[styles.legendItem, active && styles.legendItemActive]}
              >
                <View style={[styles.legendSwatch, { backgroundColor: color }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {s.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.emptyLegend}>Add pockets to your split to see lines.</Text>
      )}

      <Text style={styles.hint}>
        X: Jar balance · Y: share % · Tap a knot to edit · Slide the chart to preview
      </Text>
    </View>
  );
}

function seriesToPoints(series: PocketLineSeries, plot: ChartPlotArea): string {
  return series.points
    .map(
      (p) =>
        `${balanceToXInPlot(p.balanceMinor, plot)},${percentToYInPlot(p.percent, plot)}`
    )
    .join(' ');
}

function renderPlotBackground(plot: ChartPlotArea, colors: AppColors) {
  return (
    <Rect
      x={plot.left}
      y={plot.top}
      width={plot.width}
      height={plot.height}
      fill={colors.surfaceMuted}
      rx={10}
      stroke={colors.border}
      strokeWidth={1}
    />
  );
}

function renderGrid(
  plot: ChartPlotArea,
  balanceTicks: number[],
  colors: AppColors
) {
  const els = [];
  for (const pct of Y_AXIS_TICK_PERCENTS) {
    const y = percentToYInPlot(pct, plot);
    els.push(
      <Line
        key={`h-${pct}`}
        x1={plot.left}
        y1={y}
        x2={plot.left + plot.width}
        y2={y}
        stroke={colors.border}
        strokeWidth={pct === 0 || pct === 100 ? 1 : 0.5}
        opacity={pct === 50 ? 0.55 : 0.35}
      />
    );
  }
  for (const bal of balanceTicks) {
    const x = balanceToXInPlot(bal, plot);
    els.push(
      <Line
        key={`v-${bal}`}
        x1={x}
        y1={plot.top}
        x2={x}
        y2={plot.top + plot.height}
        stroke={colors.border}
        strokeWidth={0.5}
        opacity={0.25}
      />
    );
  }
  return els;
}

function renderKnotGuides(layout, plot, selectedKnotId, colors) {
  return layout.knots
    .filter((k) => k.kind !== 'origin')
    .map((k) => {
      const x = balanceToXInPlot(k.balanceMinor, plot);
      const knotId = k.kind === 'ceiling' ? 'default' : k.id;
      const isSelected = selectedKnotId === knotId;
      return (
        <Line
          key={`guide-${k.id}`}
          x1={x}
          y1={plot.top}
          x2={x}
          y2={plot.top + plot.height}
          stroke={isSelected ? colors.primary : colors.borderStrong}
          strokeWidth={isSelected ? 1.5 : 0.75}
          strokeDasharray={isSelected ? undefined : '3 5'}
          opacity={isSelected ? 0.65 : 0.3}
        />
      );
    });
}

function renderPocketLine(series, plot, palette, selectedKnot, colors) {
  const color = pocketChartColor(series.pocketId, palette);
  const inSelectedKnot =
    selectedKnot != null &&
    selectedKnot.splits.some((r) => r.pocketId === series.pocketId && r.percent > 0);
  const strokeWidth = inSelectedKnot ? 3.25 : 2.25;
  const opacity = selectedKnot && !inSelectedKnot ? 0.38 : 1;
  const points = seriesToPoints(series, plot);

  return (
    <G key={series.pocketId} opacity={opacity}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.18}
      />
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

function renderKnotOnAxis(knot, plot, selectedKnotId, colors) {
  const x = balanceToXInPlot(knot.balanceMinor, plot);
  const y = plot.top + plot.height;
  const knotId = knot.kind === 'ceiling' ? 'default' : knot.id;
  const isSelected = selectedKnotId === knotId;
  return (
    <G key={`axis-${knot.id}`}>
      <Circle
        cx={x}
        cy={y}
        r={isSelected ? 8 : 6}
        fill={knot.kind === 'ceiling' ? colors.chipBg : colors.surface}
        stroke={isSelected ? colors.primary : colors.borderStrong}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
    </G>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 12,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    toolbarTitle: { fontFamily: font.semibold, fontSize: 15, color: c.text },
    addBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: c.chipBg,
    },
    addBtnText: { color: c.primary, fontFamily: font.semibold, fontSize: 14 },
    chartBox: { position: 'relative', width: '100%' },
    plotTouch: { position: 'absolute' },
    yLabels: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 38,
      height: '100%',
    },
    yLabel: {
      position: 'absolute',
      right: 4,
      width: 34,
      fontSize: 9,
      color: c.textMuted,
      textAlign: 'right',
      fontFamily: font.regular,
    },
    knotHit: {
      position: 'absolute',
      width: KNOT_HIT,
      height: KNOT_HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    knotCore: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.borderStrong,
    },
    knotCoreSelected: {
      borderColor: c.primary,
      backgroundColor: c.chipBg,
    },
    knotCeiling: {
      borderRadius: 3,
      width: 14,
      height: 14,
    },
    tickLabels: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 18,
    },
    tickLabel: {
      position: 'absolute',
      fontSize: 9,
      color: c.textMuted,
      textAlign: 'center',
      fontFamily: font.regular,
    },
    legendScroll: { marginTop: 10, maxHeight: LEGEND_ROW_HEIGHT + 4 },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: c.chipBg,
      maxWidth: 120,
    },
    legendItemActive: {
      borderWidth: 1,
      borderColor: c.primary,
    },
    legendSwatch: {
      width: 14,
      height: 3,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 12,
      color: c.textSecondary,
      fontFamily: font.regular,
      flexShrink: 1,
    },
    emptyLegend: {
      marginTop: 8,
      fontSize: 12,
      color: c.textMuted,
    },
    hint: {
      marginTop: 8,
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
