// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';

import { ModalSelectField } from '../components/ModalSelectField';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import { resolveTimeRange, TimeRangePickerField } from '../components/TimeRangePickerField';
import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import {
  downsampleTimeline,
  getBalanceTimeline,
  getCategorySlices,
  getEarliestOccurredAt,
  getPocketSlicesAt,
} from '../db/repositories/statistics';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { AMOUNT_MINOR_SCALE, formatMinorToAmountString } from '../utils/amountMinor';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';
import { pocketChartColor } from '../utils/pocketChartColors';

/** Must match LineChart `yAxisLabelWidth` so layout math stays consistent. */
const Y_AXIS_LABEL_WIDTH = 52;
const CHART_INITIAL_SPACING = 2;
const CHART_END_SPACING = 2;

const MAX_LINE_POINTS = 72;

/** Sections above the zero line; matches the `noOfSections` passed to LineChart. */
const LINE_NO_OF_SECTIONS = 4;
/**
 * Hard cap on sections rendered below the zero line. Without an explicit `stepValue`,
 * gifted-charts derives it from `maxValue / noOfSections` and then sizes the negative area as
 * `ceil(|mostNegativeValue| / stepValue)` sections of the same height — when a deep negative dip
 * is small relative to the visible peak, that count (and the chart's total rendered height,
 * `containerHeight + noOfSectionsBelowXAxis * stepHeight`) can blow up unboundedly. Computing our
 * own `stepValue`/`maxValue`/`noOfSectionsBelowXAxis` below keeps the total height predictable.
 */
const LINE_MAX_NEG_SECTIONS = 2;

function computeLineChartScale(points: { balance_minor: number }[]) {
  const values = points.map((p) => p.balance_minor);
  const dataMax = values.length ? Math.max(0, ...values) : 0;
  const dataMin = values.length ? Math.min(0, ...values) : 0;
  if (dataMin >= 0) {
    const maxValue = dataMax || 1;
    return {
      maxValue,
      stepValue: maxValue / LINE_NO_OF_SECTIONS,
      mostNegativeValue: 0,
      noOfSectionsBelowXAxis: 0,
    };
  }
  const negMagnitude = Math.abs(dataMin);
  const stepValue = Math.max(dataMax / LINE_NO_OF_SECTIONS, negMagnitude / LINE_MAX_NEG_SECTIONS) || 1;
  const noOfSectionsBelowXAxis = Math.max(
    1,
    Math.min(LINE_MAX_NEG_SECTIONS, Math.ceil(negMagnitude / stepValue))
  );
  return {
    maxValue: stepValue * LINE_NO_OF_SECTIONS,
    stepValue,
    mostNegativeValue: dataMin,
    noOfSectionsBelowXAxis,
  };
}

/** Pie slice colors after the first (theme primary). Kept stable for legend consistency. */
const PIE_SLICE_COLORS_TAIL = [
  '#2e7d32',
  '#1565c0',
  '#6a1b9a',
  '#00838f',
  '#ef6c00',
  '#c62828',
  '#37474f',
] as const;

/**
 * Gifted Charts passes Y tick values in the same numeric space as `data[].value` (here: minor units).
 * Show human-readable major units (1.00 = one full coin), not raw integers.
 */
function formatYAxisMajorLabel(giftedLabel: string): string {
  const minor = Math.round(Number(giftedLabel));
  if (!Number.isFinite(minor)) return '';
  const major = minor / AMOUNT_MINOR_SCALE;
  const abs = Math.abs(major);
  if (abs >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(major / 1000).toFixed(1)}k`;
  if (abs >= 100) return major.toFixed(0);
  if (abs >= 10) return major.toFixed(1);
  if (abs >= 1) return major.toFixed(2);
  return major.toFixed(3);
}

function axisDateLabel(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function StatisticsScreen({ route, navigation }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: winW } = useWindowDimensions();

  const pieSliceColors = useMemo(
    () => [colors.primary, ...PIE_SLICE_COLORS_TAIL],
    [colors.primary]
  );

  const [assetTypes, setAssetTypes] = useState([]);
  const [currency, setCurrency] = useState('HUF');
  const [jarPocket, setJarPocket] = useState(null);
  const [pockets, setPockets] = useState([]);
  const [scopeKey, setScopeKey] = useState('all');
  const [rangeValue, setRangeValue] = useState({ kind: 'preset', id: '30d' });
  const [earliest, setEarliest] = useState(null);

  const [lineLoading, setLineLoading] = useState(true);
  const [linePoints, setLinePoints] = useState([]);
  const [pieSlices, setPieSlices] = useState([]);
  const [categoryExpenseSlices, setCategoryExpenseSlices] = useState([]);
  const [categoryIncomeSlices, setCategoryIncomeSlices] = useState([]);
  const [rangeMeta, setRangeMeta] = useState({ startMs: 0, endMs: 0 });
  /** Measured width of the chart row (full card content width). */
  const [chartRowWidth, setChartRowWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const showArchived = await settingsRepo.getShowArchivedPockets();
        const [types, def, jar, plist, early] = await Promise.all([
          assetTypesRepo.listAssetTypes(),
          settingsRepo.getDefaultCurrency(),
          pocketsRepo.getJarPocket(),
          pocketsRepo.listPockets(showArchived),
          getEarliestOccurredAt(),
        ]);
        setAssetTypes(types);
        const raw = route.params?.initialCurrency;
        const paramCode =
          typeof raw === 'string' && raw.trim() ? raw.trim().toUpperCase() : '';
        const fromNav =
          paramCode && types.some((t) => t.code === paramCode) ? paramCode : null;
        setCurrency((prev) => {
          if (fromNav) return fromNav;
          return types.some((t) => t.code === prev) ? prev : def;
        });
        if (paramCode) {
          navigation.setParams({ initialCurrency: undefined });
        }
        setJarPocket(jar);
        setPockets(plist);
        setEarliest(early);
      })();
    }, [navigation, route.params?.initialCurrency])
  );

  const statisticsScope = useMemo(() => {
    if (scopeKey === 'all') return { mode: 'all' };
    if (scopeKey === 'exclude_jar' && jarPocket) return { mode: 'exclude_jar', jarId: jarPocket.id };
    if (scopeKey.startsWith('pocket:')) {
      return { mode: 'pocket', pocketId: scopeKey.slice('pocket:'.length) };
    }
    return { mode: 'all' };
  }, [scopeKey, jarPocket]);

  const scopeOptions = useMemo(() => {
    const opts = [{ value: 'all', title: 'All pockets', subtitle: 'Total in this asset' }];
    if (jarPocket && !jarPocket.archived) {
      opts.push({
        value: 'exclude_jar',
        title: 'Outside Jar',
        subtitle: 'All pockets except the Jar',
      });
    }
    for (const p of pockets) {
      opts.push({
        value: `pocket:${p.id}`,
        title: p.name,
        subtitle: p.is_jar ? 'Jar' : 'Pocket',
      });
    }
    return opts;
  }, [pockets, jarPocket]);

  const scopeDisplay = useMemo(() => {
    const o = scopeOptions.find((x) => x.value === scopeKey);
    return o ? `${o.title}${o.subtitle ? ` — ${o.subtitle}` : ''}` : '';
  }, [scopeOptions, scopeKey]);

  const assetOptions = useMemo(
    () => assetTypes.map((a) => ({ value: a.code, title: a.code, subtitle: a.name })),
    [assetTypes]
  );

  const assetDisplay = useMemo(() => {
    const a = assetTypes.find((t) => t.code === currency);
    return a ? `${a.code} — ${a.name}` : currency;
  }, [assetTypes, currency]);

  useEffect(() => {
    if (scopeKey === 'exclude_jar' && (!jarPocket || jarPocket.archived)) {
      setScopeKey('all');
    }
  }, [jarPocket, scopeKey]);

  const loadCharts = useCallback(async () => {
    setLineLoading(true);
    try {
      const endMs = Date.now();
      const { startMs, endMs: e } = resolveTimeRange(rangeValue, endMs, earliest);
      setRangeMeta({ startMs, endMs: e });

      if (!currency) {
        setLinePoints([]);
        setPieSlices([]);
        setCategoryExpenseSlices([]);
        setCategoryIncomeSlices([]);
        return;
      }

      const raw = await getBalanceTimeline(currency, statisticsScope, startMs, e);
      const sampled = downsampleTimeline(raw, MAX_LINE_POINTS);
      setLinePoints(sampled);

      const showPie = statisticsScope.mode === 'all' || statisticsScope.mode === 'exclude_jar';
      if (showPie) {
        const slices = await getPocketSlicesAt(currency, e, {
          jarId: jarPocket?.id ?? null,
          excludeJar: statisticsScope.mode === 'exclude_jar',
        });
        setPieSlices(slices);
      } else {
        setPieSlices([]);
      }

      const categorySlices = await getCategorySlices(currency, statisticsScope, startMs, e);
      setCategoryExpenseSlices(categorySlices.expense);
      setCategoryIncomeSlices(categorySlices.income);
    } finally {
      setLineLoading(false);
    }
  }, [currency, statisticsScope, rangeValue, earliest, jarPocket]);

  useFocusEffect(
    useCallback(() => {
      void loadCharts();
    }, [loadCharts])
  );

  const lineChartData = useMemo(() => {
    if (linePoints.length === 0) return [];
    const n = linePoints.length;
    const labelIdx = new Set([0, n - 1]);
    if (n > 2) {
      labelIdx.add(Math.floor(n / 2));
    }
    const withLabels = linePoints.map((p, i) => ({
      value: p.balance_minor,
      label: labelIdx.has(i) ? axisDateLabel(p.at) : '',
      /** Carried through to pointer tooltip (library forwards the data item). */
      timestamp: p.at,
    }));
    if (withLabels.length === 1) {
      const first = withLabels[0];
      return [
        first,
        {
          value: first.value,
          label: axisDateLabel(rangeMeta.endMs),
          timestamp: rangeMeta.endMs,
        },
      ];
    }
    return withLabels;
  }, [linePoints, rangeMeta.endMs]);

  /**
   * Gifted LineChart total plot width = initialSpacing + (spacing * n) + endSpacing
   * for n points (it sums one spacing per point). We solve for spacing so the line fits `lineAreaW`.
   */
  const lineLayout = useMemo(() => {
    const fallbackW = Math.max(260, winW - 32);
    const rowW = chartRowWidth > 40 ? chartRowWidth : fallbackW;
    const lineAreaW = Math.max(80, rowW - Y_AXIS_LABEL_WIDTH);
    const n = lineChartData.length;
    const spacing =
      n > 0
        ? Math.max(
            1,
            (lineAreaW - CHART_INITIAL_SPACING - CHART_END_SPACING) / Math.max(n, 1)
          )
        : 8;
    return {
      lineAreaW,
      spacing,
      rowW,
    };
  }, [chartRowWidth, winW, lineChartData.length]);

  const lineScale = useMemo(() => computeLineChartScale(linePoints), [linePoints]);

  const positiveSlices = useMemo(
    () => pieSlices.filter((s) => s.balance_minor > 0),
    [pieSlices]
  );

  const pieData = useMemo(() => {
    if (positiveSlices.length === 0) return [];
    return positiveSlices.map((s, i) => ({
      value: s.balance_minor,
      color: pieSliceColors[i % pieSliceColors.length],
      text: s.name,
    }));
  }, [positiveSlices, pieSliceColors]);

  const pieTotalPositive = useMemo(
    () => positiveSlices.reduce((a, s) => a + s.balance_minor, 0),
    [positiveSlices]
  );

  const showPieSection =
    (statisticsScope.mode === 'all' || statisticsScope.mode === 'exclude_jar') &&
    positiveSlices.length > 0 &&
    pieTotalPositive > 0;

  const categoryColorFor = useCallback(
    (s) => s.color ?? (s.categoryId ? pocketChartColor(s.categoryId, pieSliceColors) : colors.textMuted),
    [pieSliceColors, colors.textMuted]
  );

  const expensePieData = useMemo(
    () =>
      categoryExpenseSlices.map((s) => ({
        value: s.total_minor,
        color: categoryColorFor(s),
        text: s.name,
      })),
    [categoryExpenseSlices, categoryColorFor]
  );
  const expensePieTotal = useMemo(
    () => categoryExpenseSlices.reduce((a, s) => a + s.total_minor, 0),
    [categoryExpenseSlices]
  );

  const incomePieData = useMemo(
    () =>
      categoryIncomeSlices.map((s) => ({
        value: s.total_minor,
        color: categoryColorFor(s),
        text: s.name,
      })),
    [categoryIncomeSlices, categoryColorFor]
  );
  const incomePieTotal = useMemo(
    () => categoryIncomeSlices.reduce((a, s) => a + s.total_minor, 0),
    [categoryIncomeSlices]
  );

  return (
    <ScreenWithFooter>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.lead}>
        Balances over time and pocket mix for one asset at a time. Totals follow your ledger;
        transfers do not change the &quot;All pockets&quot; total.
      </Text>

      <TimeRangePickerField
        label="Time range"
        value={rangeValue}
        onChange={setRangeValue}
        earliestMs={earliest}
      />

      {assetTypes.length === 0 ? (
        <Text style={styles.muted}>Add asset types under Settings to use Statistics.</Text>
      ) : (
        <>
          <ModalSelectField
            label="Asset"
            displayValue={assetDisplay}
            placeholder="Select asset"
            modalTitle="Asset"
            options={assetOptions}
            onSelect={setCurrency}
            emptyMessage="No asset types."
          />
          <ModalSelectField
            label="Scope"
            displayValue={scopeDisplay}
            placeholder="Select scope"
            modalTitle="Balance scope"
            options={scopeOptions}
            onSelect={(v) => {
              if (v === 'exclude_jar' && !jarPocket) return;
              setScopeKey(v);
            }}
            disabled={scopeOptions.length === 0}
          />
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Balance over time</Text>
        <Text style={styles.cardSub}>
          {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
        </Text>
        {lineLoading ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : lineChartData.length === 0 ? (
          <Text style={styles.muted}>No data in this range.</Text>
        ) : (
          <View
            style={styles.chartWrap}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w > 0 && Math.abs(w - chartRowWidth) > 2) {
                setChartRowWidth(w);
              }
            }}
          >
            <Text style={styles.axisHint}>
              Tap the chart for date and balance. Y-axis: {currency} (whole units). X: start · mid · end.
            </Text>
            <LineChart
              data={lineChartData}
              parentWidth={lineLayout.rowW}
              width={lineLayout.lineAreaW}
              height={220}
              spacing={lineLayout.spacing}
              initialSpacing={CHART_INITIAL_SPACING}
              endSpacing={CHART_END_SPACING}
              adjustToWidth={false}
              curved={false}
              areaChart
              hideDataPoints
              thickness={2}
              color={colors.primary}
              startFillColor={colors.primary}
              endFillColor={colors.primary}
              startOpacity={0.25}
              endOpacity={0.02}
              yAxisThickness={0}
              xAxisThickness={0}
              rulesType="solid"
              rulesColor={colors.border}
              noOfSections={LINE_NO_OF_SECTIONS}
              maxValue={lineScale.maxValue}
              stepValue={lineScale.stepValue}
              mostNegativeValue={lineScale.mostNegativeValue}
              noOfSectionsBelowXAxis={lineScale.noOfSectionsBelowXAxis}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10, fontFamily: font.regular }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
              formatYLabel={formatYAxisMajorLabel}
              xAxisTextNumberOfLines={2}
              pointerConfig={{
                pointerStripColor: colors.border,
                pointerStripWidth: 1,
                pointerColor: colors.primary,
                radius: 5,
                activatePointersOnLongPress: false,
                activatePointersInstantlyOnTouch: true,
                persistPointer: true,
                resetPointerIndexOnRelease: false,
                pointerLabelWidth: 168,
                pointerLabelHeight: 64,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items, _secondary, pointerIndex) => {
                  const it = items?.[0];
                  if (!it) return null;
                  const v = Math.round(Number(it.value));
                  const idx = typeof pointerIndex === 'number' ? pointerIndex : 0;
                  const ts =
                    typeof it.timestamp === 'number'
                      ? it.timestamp
                      : typeof lineChartData[idx]?.timestamp === 'number'
                        ? lineChartData[idx].timestamp
                        : null;
                  return (
                    <View style={styles.pointerBox}>
                      {ts != null ? (
                        <Text style={styles.pointerDate}>{formatOccurredAt(ts)}</Text>
                      ) : null}
                      <Text style={styles.pointerAmt}>{formatMinorForDisplay(v, currency)}</Text>
                    </View>
                  );
                },
              }}
            />
          </View>
        )}
      </View>

      {showPieSection ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pocket mix at period end</Text>
          <Text style={styles.cardSub}>Share of {currency} balance by pocket</Text>
          <View style={styles.pieWrap}>
            <PieChart
              data={pieData}
              donut
              showText={false}
              innerRadius={48}
              radius={92}
              innerCircleColor={colors.surface}
              centerLabelComponent={() => (
                <View style={styles.pieCenter}>
                  <Text style={styles.pieCenterLabel} numberOfLines={2}>
                    {formatMinorToAmountString(pieTotalPositive)}
                  </Text>
                  <Text style={styles.pieCenterSub}>{currency}</Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legend}>
            {positiveSlices.map((s, i) => (
              <View key={s.pocketId} style={styles.legendRow}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: pieSliceColors[i % pieSliceColors.length] },
                  ]}
                />
                <Text style={styles.legendName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.legendAmt}>
                  {formatMinorForDisplay(s.balance_minor, currency)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : !lineLoading && statisticsScope.mode !== 'pocket' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pocket mix</Text>
          <Text style={styles.muted}>No positive balances to show for this asset at the end of the range.</Text>
        </View>
      ) : statisticsScope.mode === 'pocket' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pocket mix</Text>
          <Text style={styles.muted}>
            Switch scope to &quot;All pockets&quot; or &quot;Outside Jar&quot; to see a split chart.
          </Text>
        </View>
      ) : null}

      {!lineLoading && currency ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by category</Text>
          <Text style={styles.cardSub}>
            {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
          </Text>
          {expensePieData.length === 0 ? (
            <Text style={styles.muted}>No categorized expenses in this range.</Text>
          ) : (
            <>
              <View style={styles.pieWrap}>
                <PieChart
                  data={expensePieData}
                  donut
                  showText={false}
                  innerRadius={48}
                  radius={92}
                  innerCircleColor={colors.surface}
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text style={styles.pieCenterLabel} numberOfLines={2}>
                        {formatMinorToAmountString(expensePieTotal)}
                      </Text>
                      <Text style={styles.pieCenterSub}>{currency}</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.legend}>
                {categoryExpenseSlices.map((s) => (
                  <View key={s.categoryId ?? '__uncategorized__'} style={styles.legendRow}>
                    <View
                      style={[styles.legendSwatch, { backgroundColor: categoryColorFor(s) }]}
                    />
                    <Text style={styles.legendName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.legendAmt}>
                      {formatMinorForDisplay(s.total_minor, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      ) : null}

      {!lineLoading && currency ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income by category</Text>
          <Text style={styles.cardSub}>
            {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
          </Text>
          {incomePieData.length === 0 ? (
            <Text style={styles.muted}>No categorized income in this range.</Text>
          ) : (
            <>
              <View style={styles.pieWrap}>
                <PieChart
                  data={incomePieData}
                  donut
                  showText={false}
                  innerRadius={48}
                  radius={92}
                  innerCircleColor={colors.surface}
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text style={styles.pieCenterLabel} numberOfLines={2}>
                        {formatMinorToAmountString(incomePieTotal)}
                      </Text>
                      <Text style={styles.pieCenterSub}>{currency}</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.legend}>
                {categoryIncomeSlices.map((s) => (
                  <View key={s.categoryId ?? '__uncategorized__'} style={styles.legendRow}>
                    <View
                      style={[styles.legendSwatch, { backgroundColor: categoryColorFor(s) }]}
                    />
                    <Text style={styles.legendName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.legendAmt}>
                      {formatMinorForDisplay(s.total_minor, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
    </ScreenWithFooter>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    inner: { paddingVertical: 16, paddingHorizontal: 12, paddingBottom: 40 },
    lead: { fontSize: 14, color: c.textMuted, lineHeight: 21, marginBottom: 16 },
    cardLabel: { fontSize: 13, fontFamily: font.semibold, color: c.textMuted, marginBottom: 8 },
    muted: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
    card: {
      marginTop: 20,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: { fontFamily: font.bold, fontSize: 17, color: c.text },
    cardSub: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 12 },
    chartLoading: { height: 220, justifyContent: 'center', alignItems: 'center' },
    chartWrap: {
      alignSelf: 'stretch',
      overflow: 'hidden',
      marginTop: 4,
    },
    axisHint: {
      fontSize: 11,
      color: c.textMuted,
      lineHeight: 16,
      marginBottom: 10,
    },
    pointerBox: {
      backgroundColor: c.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: 168,
    },
    pointerDate: { fontSize: 11, color: c.textMuted, marginBottom: 4 },
    pointerAmt: { fontSize: 13, fontFamily: font.semibold, color: c.text },
    pieWrap: { alignItems: 'center', marginVertical: 8 },
    pieCenter: { alignItems: 'center', justifyContent: 'center', maxWidth: 72 },
    pieCenterLabel: {
      fontSize: 11,
      fontFamily: font.bold,
      color: c.text,
      textAlign: 'center',
    },
    pieCenterSub: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    legend: { marginTop: 12, gap: 8 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3 },
    legendName: { flex: 1, fontSize: 14, color: c.textSecondary },
    legendAmt: { fontSize: 13, color: c.textMuted, fontFamily: font.semibold },
  });
}
