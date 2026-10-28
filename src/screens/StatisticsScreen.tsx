import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { DonutChart, type DonutSlice } from '../components/DonutChart';
import { ModalSelectField } from '../components/ModalSelectField';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import {
  formatTimeRangeLabel,
  resolveTimeRange,
  TimeRangePickerField,
  type TimeRangeValue,
} from '../components/TimeRangePickerField';
import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as categoriesRepo from '../db/repositories/categories';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import {
  downsampleTimeline,
  getBalanceTimeline,
  getCategorySlices,
  getEarliestOccurredAt,
  getPocketSlicesAt,
  type BalanceTimelinePoint,
  type CategoryFilter,
  type CategorySlice,
  type PocketSlice,
  type StatisticsScope,
} from '../db/repositories/statistics';
import type { AssetType, Category, Pocket } from '../domain/types';
import type { RootStackScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { AMOUNT_MINOR_SCALE } from '../utils/amountMinor';
import { animateNextLayout } from '../utils/animateLayout';
import { formatMinorAmountForDisplay, formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';
import { formatShare } from '../utils/formatShare';
import { assignChartColors, buildThemeChartPalette, resolveStoredColor } from '../utils/pocketChartColors';

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

type ActivePoint = { ts: number; v: number };

function axisDateLabel(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function StatisticsScreen({ route, navigation }: RootStackScreenProps<'Statistics'>) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: winW } = useWindowDimensions();

  const chartPalette = useMemo(() => buildThemeChartPalette(colors, isDark), [colors, isDark]);

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [currency, setCurrency] = useState('HUF');
  const [jarPocket, setJarPocket] = useState<Pocket | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scopeKey, setScopeKey] = useState('all');
  const [categoryFilterKey, setCategoryFilterKey] = useState('all');
  const [rangeValue, setRangeValue] = useState<TimeRangeValue>({ kind: 'preset', id: '30d' });
  const [earliest, setEarliest] = useState<number | null>(null);
  /** Collapsed by default — Asset/Scope/Category/Range all have sensible defaults, so nothing
   *  requires the user to open this before the charts render. */
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const [lineLoading, setLineLoading] = useState(true);
  const [linePoints, setLinePoints] = useState<BalanceTimelinePoint[]>([]);
  const [pieSlices, setPieSlices] = useState<PocketSlice[]>([]);
  const [categoryExpenseSlices, setCategoryExpenseSlices] = useState<CategorySlice[]>([]);
  const [categoryIncomeSlices, setCategoryIncomeSlices] = useState<CategorySlice[]>([]);
  const [rangeMeta, setRangeMeta] = useState({ startMs: 0, endMs: 0 });
  /** Measured width of the chart row (full card content width). */
  const [chartRowWidth, setChartRowWidth] = useState(0);
  /**
   * Touched chart point, shown in a fixed-position readout row instead of a floating tooltip.
   * A floating, absolutely-positioned label rendered by the chart library was getting clipped by
   * Android's ScrollView view-flattening whenever it needed to render outside its own box, no
   * matter what z-index/elevation/collapsable combination was tried — a fixed row in normal
   * layout flow can't be clipped that way since nothing needs to escape its own bounds.
   */
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null);
  const activePointRef = useRef<ActivePoint | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const showArchived = await settingsRepo.getShowArchivedPockets();
        const [types, def, jar, plist, early, cats] = await Promise.all([
          assetTypesRepo.listAssetTypes(),
          settingsRepo.getDefaultCurrency(),
          pocketsRepo.getJarPocket(),
          pocketsRepo.listPockets(showArchived),
          getEarliestOccurredAt(),
          categoriesRepo.listCategories(),
        ]);
        setAssetTypes(types);
        setCategories(cats);
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

  const statisticsScope = useMemo((): StatisticsScope => {
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

  const scopeShortLabel = useMemo(() => {
    const o = scopeOptions.find((x) => x.value === scopeKey);
    return o?.title ?? 'All pockets';
  }, [scopeOptions, scopeKey]);

  /** Categories never apply to transfers, so a category filter narrows the same charts down to
   *  "this category's income/expense only" — transfers simply drop out of every total. */
  const categoryFilter = useMemo((): CategoryFilter => {
    if (categoryFilterKey === 'uncategorized') return { mode: 'uncategorized' };
    if (categoryFilterKey.startsWith('cat:')) {
      return { mode: 'one', categoryId: categoryFilterKey.slice('cat:'.length) };
    }
    return { mode: 'all' };
  }, [categoryFilterKey]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'all', title: 'All categories' },
      { value: 'uncategorized', title: 'Uncategorized' },
      ...categories.map((c) => ({ value: `cat:${c.id}`, title: c.name })),
    ],
    [categories]
  );

  const categoryFilterDisplay = useMemo(() => {
    if (categoryFilterKey === 'all') return 'All categories';
    if (categoryFilterKey === 'uncategorized') return 'Uncategorized';
    const cat = categories.find((c) => `cat:${c.id}` === categoryFilterKey);
    return cat?.name ?? 'Category';
  }, [categoryFilterKey, categories]);

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

  useEffect(() => {
    if (
      categoryFilterKey.startsWith('cat:') &&
      !categories.some((c) => `cat:${c.id}` === categoryFilterKey)
    ) {
      setCategoryFilterKey('all');
    }
  }, [categories, categoryFilterKey]);

  const loadCharts = useCallback(async () => {
    setLineLoading(true);
    activePointRef.current = null;
    setActivePoint(null);
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

      const raw = await getBalanceTimeline(currency, statisticsScope, startMs, e, categoryFilter);
      const sampled = downsampleTimeline(raw, MAX_LINE_POINTS);
      setLinePoints(sampled);

      const showPie = statisticsScope.mode === 'all' || statisticsScope.mode === 'exclude_jar';
      if (showPie) {
        const slices = await getPocketSlicesAt(
          currency,
          e,
          { jarId: jarPocket?.id ?? null, excludeJar: statisticsScope.mode === 'exclude_jar' },
          categoryFilter
        );
        setPieSlices(slices);
      } else {
        setPieSlices([]);
      }

      // Breaking a single category down "by category" is trivial (one slice), so these cards
      // are only meaningful when no category filter narrows the data first.
      if (categoryFilter.mode === 'all') {
        const categorySlices = await getCategorySlices(currency, statisticsScope, startMs, e);
        setCategoryExpenseSlices(categorySlices.expense);
        setCategoryIncomeSlices(categorySlices.income);
      } else {
        setCategoryExpenseSlices([]);
        setCategoryIncomeSlices([]);
      }
    } catch (e) {
      Alert.alert('Could not load', e instanceof Error ? e.message : String(e));
    } finally {
      setLineLoading(false);
    }
  }, [currency, statisticsScope, categoryFilter, rangeValue, earliest, jarPocket]);

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

  /** The chart is drawn, so a screen reader gets its shape as one sentence instead. */
  const lineChartSummary = useMemo(() => {
    if (linePoints.length === 0) return '';
    const values = linePoints.map((p) => p.balance_minor);
    const first = values[0]!;
    const last = values[values.length - 1]!;
    const lowest = values.reduce((a, v) => (v < a ? v : a), first);
    const highest = values.reduce((a, v) => (v > a ? v : a), first);
    const fmt = (v: number) => formatMinorForDisplay(v, currency);
    return `Line chart, ${currency}, from ${axisDateLabel(rangeMeta.startMs)} to ${axisDateLabel(rangeMeta.endMs)}. Starts at ${fmt(first)}, ends at ${fmt(last)}, lowest ${fmt(lowest)}, highest ${fmt(highest)}.`;
  }, [linePoints, currency, rangeMeta.startMs, rangeMeta.endMs]);

  const positiveSlices = useMemo(
    () => pieSlices.filter((s) => s.balance_minor > 0n),
    [pieSlices]
  );
  const negativeSlices = useMemo(
    () => pieSlices.filter((s) => s.balance_minor < 0n),
    [pieSlices]
  );

  /** Falls back to the negative side when nothing is positive — the normal case once a category
   *  filter narrows this down to an expense-only category, where every pocket's total is negative. */
  const pieIsNegative = positiveSlices.length === 0 && negativeSlices.length > 0;
  const pieDisplaySlices = pieIsNegative ? negativeSlices : positiveSlices;

  const pocketDonutSlices = useMemo<DonutSlice[]>(() => {
    const total = pieDisplaySlices.reduce((a, sl) => a + sl.balance_minor, 0n);
    const colorById = assignChartColors(pieDisplaySlices.map((sl) => sl.pocketId), chartPalette);
    return pieDisplaySlices.map((sl) => ({
      key: sl.pocketId,
      name: sl.name,
      color: colorById.get(sl.pocketId)!,
      // The donut only needs the proportions, so a float is fine here.
      value: Math.abs(Number(sl.balance_minor)),
      amountText: formatMinorForDisplay(sl.balance_minor, currency),
      shareText: formatShare(sl.balance_minor, total),
    }));
  }, [pieDisplaySlices, chartPalette, currency]);

  const pieTotal = useMemo(
    () => pieDisplaySlices.reduce((a, s) => a + s.balance_minor, 0n),
    [pieDisplaySlices]
  );

  const showPieSection =
    (statisticsScope.mode === 'all' || statisticsScope.mode === 'exclude_jar') &&
    pieDisplaySlices.length > 0 &&
    pieTotal !== 0n;

  const categoryColors = useMemo(
    () =>
      assignChartColors(
        [...categoryExpenseSlices, ...categoryIncomeSlices].flatMap((sl) => (sl.categoryId ? [sl.categoryId] : [])),
        chartPalette
      ),
    [categoryExpenseSlices, categoryIncomeSlices, chartPalette]
  );

  const categoryDonutSlices = useCallback(
    (slices: CategorySlice[]): DonutSlice[] => {
      const total = slices.reduce((a, sl) => a + sl.total_minor, 0);
      return slices.map((sl) => ({
        key: sl.categoryId ?? '__uncategorized__',
        name: sl.name,
        color:
          resolveStoredColor(sl.color, chartPalette) ??
          (sl.categoryId ? categoryColors.get(sl.categoryId) : undefined) ??
          colors.textMuted,
        value: sl.total_minor,
        amountText: formatMinorForDisplay(sl.total_minor, currency),
        shareText: formatShare(sl.total_minor, total),
      }));
    },
    [chartPalette, categoryColors, colors.textMuted, currency]
  );

  const expenseDonutSlices = useMemo(
    () => categoryDonutSlices(categoryExpenseSlices),
    [categoryDonutSlices, categoryExpenseSlices]
  );
  const expensePieTotal = useMemo(
    () => categoryExpenseSlices.reduce((a, s) => a + s.total_minor, 0),
    [categoryExpenseSlices]
  );

  const incomeDonutSlices = useMemo(
    () => categoryDonutSlices(categoryIncomeSlices),
    [categoryDonutSlices, categoryIncomeSlices]
  );
  const incomePieTotal = useMemo(
    () => categoryIncomeSlices.reduce((a, s) => a + s.total_minor, 0),
    [categoryIncomeSlices]
  );

  const categoryFilterSuffix =
    categoryFilter.mode === 'all' ? '' : ` · ${categoryFilterDisplay} only`;

  const toggleSettingsExpanded = () => {
    animateNextLayout();
    setSettingsExpanded((v) => !v);
  };

  const timeRangeShortLabel = useMemo(() => formatTimeRangeLabel(rangeValue), [rangeValue]);

  const settingsChips = useMemo(
    () => [
      { key: 'asset', label: currency || 'Asset' },
      { key: 'scope', label: scopeShortLabel },
      { key: 'category', label: categoryFilterDisplay },
      { key: 'range', label: timeRangeShortLabel },
    ],
    [currency, scopeShortLabel, categoryFilterDisplay, timeRangeShortLabel]
  );

  return (
    <ScreenWithFooter>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.lead}>
        Balances over time, pocket mix, and category totals for one asset at a time. Totals follow
        your ledger; transfers do not change the &quot;All pockets&quot; total or count toward any category.
      </Text>

      <Pressable
        style={styles.exportBtn}
        onPress={() => navigation.navigate('ReportExport')}
        accessibilityRole="button"
      >
        <Text style={styles.exportBtnText}>Export report…</Text>
      </Pressable>

      {assetTypes.length === 0 ? (
        <Text style={styles.muted}>Add asset types under Settings to use Statistics.</Text>
      ) : (
        <View style={styles.settingsSection}>
          <Pressable style={styles.settingsHeaderRow} onPress={toggleSettingsExpanded}>
            <Text style={styles.settingsSectionTitle}>Statistics settings</Text>
            <Text style={styles.settingsChevron}>{settingsExpanded ? '▴' : '▾'}</Text>
          </Pressable>

          {!settingsExpanded ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.settingsChipRow}
            >
              {settingsChips.map((chip) => (
                <Pressable key={chip.key} style={styles.settingsChip} onPress={toggleSettingsExpanded}>
                  <Text style={styles.settingsChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.settingsFields}>
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
              <ModalSelectField
                label="Category"
                displayValue={categoryFilterDisplay}
                placeholder="Select category"
                modalTitle="Category"
                options={categoryFilterOptions}
                onSelect={setCategoryFilterKey}
                emptyMessage="No categories yet."
              />
              <TimeRangePickerField
                label="Time range"
                value={rangeValue}
                onChange={setRangeValue}
                earliestMs={earliest}
              />
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {categoryFilter.mode === 'all' ? 'Balance over time' : 'Category total over time'}
        </Text>
        <Text style={styles.cardSub}>
          {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
          {categoryFilterSuffix}
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
            <View style={styles.readoutRow}>
              {activePoint ? (
                <>
                  <Text style={styles.readoutDate}>{formatOccurredAt(activePoint.ts)}</Text>
                  <Text style={styles.readoutAmt}>
                    {formatMinorForDisplay(activePoint.v, currency)}
                  </Text>
                </>
              ) : (
                <Text style={styles.axisHint}>
                  Tap the chart for date and balance. Y-axis: {currency} (whole units). X: start ·
                  mid · end.
                </Text>
              )}
            </View>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={lineChartSummary}
              importantForAccessibility="no-hide-descendants"
            >
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
                xAxisThickness={1}
                xAxisColor={colors.textMuted}
                rulesType="solid"
                rulesColor={colors.border}
                noOfSections={LINE_NO_OF_SECTIONS}
                maxValue={lineScale.maxValue}
                stepValue={lineScale.stepValue}
                mostNegativeValue={lineScale.mostNegativeValue}
                noOfSectionsBelowXAxis={lineScale.noOfSectionsBelowXAxis}
                yAxisTextStyle={{ color: colors.textMuted, fontSize: 12, fontFamily: font.regular }}
                xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 12 }}
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
                  // No floating label box (see `readoutRow` above the chart) — this callback only
                  // reports the touched point's data into React state. It fires during the chart
                  // library's own render pass, so the update is deferred a tick (requestAnimationFrame)
                  // rather than calling setState synchronously while a different component renders.
                  pointerLabelComponent: (
                    items: { value: number; timestamp?: number }[] | undefined,
                    _secondary: unknown,
                    pointerIndex: unknown
                  ) => {
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
                    if (ts != null && (activePointRef.current?.ts !== ts || activePointRef.current?.v !== v)) {
                      const next = { ts, v };
                      activePointRef.current = next;
                      requestAnimationFrame(() => setActivePoint(next));
                    }
                    return null;
                  },
                }}
              />
            </View>
          </View>
        )}
      </View>

      {showPieSection ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {pieIsNegative ? 'Pocket mix (negative)' : 'Pocket mix at period end'}
          </Text>
          <Text style={styles.cardSub}>
            {pieIsNegative
              ? `Where the negative ${currency} balance is concentrated, by pocket`
              : `Share of ${currency} balance by pocket`}
            {categoryFilterSuffix}
          </Text>
          <DonutChart
            slices={pocketDonutSlices}
            centerText={formatMinorAmountForDisplay(pieTotal, currency)}
            centerSub={currency}
          />
        </View>
      ) : !lineLoading && statisticsScope.mode !== 'pocket' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pocket mix</Text>
          <Text style={styles.muted}>No balances to show for this asset at the end of the range.</Text>
        </View>
      ) : statisticsScope.mode === 'pocket' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pocket mix</Text>
          <Text style={styles.muted}>
            Switch scope to &quot;All pockets&quot; or &quot;Outside Jar&quot; to see a split chart.
          </Text>
        </View>
      ) : null}

      {!lineLoading && currency && categoryFilter.mode === 'all' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by category</Text>
          <Text style={styles.cardSub}>
            {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
          </Text>
          {expenseDonutSlices.length === 0 ? (
            <Text style={styles.muted}>No categorized expenses in this range.</Text>
          ) : (
            <DonutChart
              slices={expenseDonutSlices}
              centerText={formatMinorAmountForDisplay(expensePieTotal, currency)}
              centerSub={currency}
            />
          )}
        </View>
      ) : null}

      {!lineLoading && currency && categoryFilter.mode === 'all' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income by category</Text>
          <Text style={styles.cardSub}>
            {axisDateLabel(rangeMeta.startMs)} → {axisDateLabel(rangeMeta.endMs)} · {currency}
          </Text>
          {incomeDonutSlices.length === 0 ? (
            <Text style={styles.muted}>No categorized income in this range.</Text>
          ) : (
            <DonutChart
              slices={incomeDonutSlices}
              centerText={formatMinorAmountForDisplay(incomePieTotal, currency)}
              centerSub={currency}
            />
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
    inner: { paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 40 },
    lead: { fontSize: 14, color: c.textMuted, lineHeight: 21, marginBottom: 16 },
    exportBtn: {
      backgroundColor: c.surface,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
      marginBottom: 16,
    },
    exportBtnText: { color: c.primary, fontFamily: font.semibold, fontSize: 15 },
    cardLabel: { fontSize: 13, fontFamily: font.semibold, color: c.textMuted, marginBottom: 8 },
    muted: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
    settingsSection: {
      backgroundColor: c.chipBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      marginBottom: 4,
    },
    settingsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    settingsSectionTitle: { fontSize: 13, fontFamily: font.semibold, color: c.primary },
    settingsChevron: { fontSize: 22, color: c.primary, fontFamily: font.semibold, lineHeight: 22 },
    settingsChipRow: { flexDirection: 'row', gap: 6, marginTop: 6, paddingRight: 8 },
    settingsChip: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      maxWidth: 160,
    },
    settingsChipText: { fontSize: 12, color: c.textSecondary, fontFamily: font.semibold },
    settingsFields: { marginTop: 8, gap: 4 },
    card: {
      marginTop: 20,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: { fontFamily: font.bold, fontSize: 17, color: c.text },
    cardSub: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 12 },
    chartLoading: { height: 220, justifyContent: 'center', alignItems: 'center' },
    chartWrap: {
      alignSelf: 'stretch',
      marginTop: 4,
    },
    /** Fixed-position readout for the touched point — normal layout flow, not an absolutely
     *  positioned overlay, so it can't be clipped by Android's ScrollView view-flattening the
     *  way a floating chart-library tooltip was. */
    readoutRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      minHeight: 18,
      marginBottom: 10,
    },
    axisHint: {
      fontSize: 12,
      color: c.textMuted,
      lineHeight: 16,
    },
    readoutDate: { fontSize: 12, color: c.textMuted },
    readoutAmt: { fontSize: 14, fontFamily: font.semibold, color: c.text },
  });
}
