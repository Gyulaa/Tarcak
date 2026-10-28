import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';

import { ModalSelectField } from '../components/ModalSelectField';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import {
  resolveTimeRange,
  TimeRangePickerField,
  type TimeRangeValue,
} from '../components/TimeRangePickerField';
import * as pocketsRepo from '../db/repositories/pockets';
import { getReportRows } from '../db/repositories/report';
import * as settingsRepo from '../db/repositories/settings';
import { getEarliestOccurredAt, type StatisticsScope } from '../db/repositories/statistics';
import {
  buildReportCsv,
  buildReportPreview,
  MAX_REPORT_MONTHS,
  monthRangeFor,
  type CsvFormat,
  type ReportMonth,
  type ReportOptions,
  type ReportRow,
} from '../domain/monthlyReport';
import type { Pocket } from '../domain/types';
import { resumeVaultLockOnBackground, suspendVaultLockOnBackground } from '../security';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { deleteReportFile, purgeReportFiles, writeReportFile } from '../utils/reportFile';

const FORMAT_OPTIONS: { value: CsvFormat; title: string; subtitle: string }[] = [
  { value: 'international', title: 'International', subtitle: 'Comma between columns, decimal point' },
  { value: 'hungarian', title: 'Hungarian', subtitle: 'Semicolon between columns, decimal comma' },
];

/** The last 12 calendar months including the current one. */
function defaultRange(): TimeRangeValue {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return {
    kind: 'custom',
    fromYear: from.getFullYear(),
    fromMonth: from.getMonth(),
    toYear: now.getFullYear(),
    toMonth: now.getMonth(),
  };
}

export default function ReportExportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [jarPocket, setJarPocket] = useState<Pocket | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [earliest, setEarliest] = useState<number | null>(null);
  const [scopeKey, setScopeKey] = useState('all');
  const [rangeValue, setRangeValue] = useState<TimeRangeValue>(defaultRange);
  const [breakdown, setBreakdown] = useState(false);
  const [format, setFormat] = useState<CsvFormat>('international');
  /** Currencies the user switched off; a currency that shows up later starts switched on. */
  const [skipped, setSkipped] = useState<string[]>([]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Earlier report files are not needed any more; best effort.
  useEffect(() => {
    void purgeReportFiles().catch(() => {});
  }, []);

  useEffect(() => {
    void (async () => {
      const showArchived = await settingsRepo.getShowArchivedPockets();
      const [jar, plist, early] = await Promise.all([
        pocketsRepo.getJarPocket(),
        pocketsRepo.listPockets(showArchived),
        getEarliestOccurredAt(),
      ]);
      setJarPocket(jar);
      setPockets(plist);
      setEarliest(early);
    })();
  }, []);

  useEffect(() => {
    if (scopeKey === 'exclude_jar' && (!jarPocket || jarPocket.archived)) {
      setScopeKey('all');
    }
  }, [jarPocket, scopeKey]);

  const scope = useMemo((): StatisticsScope => {
    if (scopeKey === 'exclude_jar' && jarPocket) return { mode: 'exclude_jar', jarId: jarPocket.id };
    if (scopeKey.startsWith('pocket:')) {
      return { mode: 'pocket', pocketId: scopeKey.slice('pocket:'.length) };
    }
    return { mode: 'all' };
  }, [scopeKey, jarPocket]);

  const scopeOptions = useMemo(() => {
    const opts = [{ value: 'all', title: 'All pockets', subtitle: 'Total in each currency' }];
    if (jarPocket && !jarPocket.archived) {
      opts.push({ value: 'exclude_jar', title: 'Outside Jar', subtitle: 'All pockets except the Jar' });
    }
    for (const p of pockets) {
      opts.push({ value: `pocket:${p.id}`, title: p.name, subtitle: p.is_jar ? 'Jar' : 'Pocket' });
    }
    return opts;
  }, [pockets, jarPocket]);

  const scopeDisplay = useMemo(() => {
    const o = scopeOptions.find((x) => x.value === scopeKey);
    return o ? `${o.title}${o.subtitle ? ` · ${o.subtitle}` : ''}` : '';
  }, [scopeOptions, scopeKey]);

  const nowMs = useMemo(() => Date.now(), []);

  const { months, rangeError } = useMemo((): { months: ReportMonth[]; rangeError: string | null } => {
    try {
      const { startMs, endMs } = resolveTimeRange(rangeValue, nowMs, earliest);
      return { months: monthRangeFor(startMs, endMs), rangeError: null };
    } catch (e) {
      return { months: [], rangeError: e instanceof Error ? e.message : String(e) };
    }
  }, [rangeValue, nowMs, earliest]);

  const currentMonthKey = useMemo(
    () => months.find((m) => nowMs >= m.fromMs && nowMs < m.toMs)?.key ?? null,
    [months, nowMs]
  );

  useEffect(() => {
    if (months.length === 0) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getReportRows({ months, scope })
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoadError('Could not read the ledger. Try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [months, scope]);

  const availableCurrencies = useMemo(
    () => [...new Set(rows.map((r) => r.currency))].sort(),
    [rows]
  );
  const selectedCurrencies = useMemo(
    () => availableCurrencies.filter((c) => !skipped.includes(c)),
    [availableCurrencies, skipped]
  );

  const options = useMemo(
    (): ReportOptions => ({
      months: months.map((m) => m.key),
      currencies: selectedCurrencies,
      breakdown,
      format,
    }),
    [months, selectedCurrencies, breakdown, format]
  );
  const preview = useMemo(() => buildReportPreview(rows, options), [rows, options]);

  // A currency that dropped out of the range and comes back starts switched on again.
  useEffect(() => {
    setSkipped((prev) => {
      const kept = prev.filter((c) => availableCurrencies.includes(c));
      return kept.length === prev.length ? prev : kept;
    });
  }, [availableCurrencies]);

  const toggleCurrency = (code: string, on: boolean) => {
    setSkipped((prev) => (on ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const emptyReason = rangeError
    ? rangeError
    : availableCurrencies.length === 0
      ? 'No income or expenses in this time range and scope, so there is nothing to export.'
      : selectedCurrencies.length === 0
        ? 'Switch on at least one currency.'
        : preview.isEmpty
          ? 'The category breakdown has nothing to list: every category nets to zero.'
          : null;
  const canExport = Platform.OS !== 'web' && !loading && !loadError && !busy && !emptyReason;

  /** Lock-on-background stays suspended until the share sheet returns, then resumes in `finally`. */
  const runExport = async () => {
    setBusy(true);
    suspendVaultLockOnBackground();
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', 'This device cannot share files from the app, so no report was created.');
        return;
      }
      const uri = await writeReportFile(buildReportCsv(rows, options));
      try {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Share Tarcak report',
          UTI: 'public.comma-separated-values-text',
        });
      } catch (e) {
        await deleteReportFile(uri).catch(() => {});
        throw e;
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      resumeVaultLockOnBackground();
      setBusy(false);
    }
  };

  /** `busy` covers the dialog too, so a double tap cannot open two exports. */
  const confirmExport = () => {
    setBusy(true);
    Alert.alert(
      'Share an unencrypted file?',
      'This file is not encrypted. After you share it, the app you share it with keeps it.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setBusy(false) },
        { text: 'Share', onPress: () => void runExport() },
      ],
      { cancelable: false }
    );
  };

  const switchProps = (value: boolean) => ({
    value,
    trackColor: { false: colors.switchTrackOff, true: colors.switchTrackOn },
    thumbColor: value ? colors.switchThumbOn : colors.switchThumbOff,
  });

  return (
    <ScreenWithFooter>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
        <Text style={styles.lead}>
          Monthly income and expenses as a CSV. No pocket names, titles or exact dates.
        </Text>

        {Platform.OS === 'web' ? (
          <Text style={styles.muted}>Export is available in the Android or iOS app.</Text>
        ) : null}

        <View style={styles.fields}>
          <TimeRangePickerField
            label="Time range"
            value={rangeValue}
            onChange={setRangeValue}
            earliestMs={earliest}
          />
          <ModalSelectField
            label="Scope"
            displayValue={scopeDisplay}
            placeholder="Select scope"
            modalTitle="Scope"
            options={scopeOptions}
            onSelect={setScopeKey}
            disabled={scopeOptions.length === 0}
          />
          <ModalSelectField
            label="CSV format"
            displayValue={FORMAT_OPTIONS.find((f) => f.value === format)?.title ?? ''}
            placeholder="Select format"
            modalTitle="CSV format"
            options={FORMAT_OPTIONS}
            onSelect={(v) => setFormat(v as CsvFormat)}
          />
        </View>
        <Text style={styles.hint}>
          Whole months{months.length > 0 ? `, ${months[0].key} to ${months[months.length - 1].key}` : ''}; at most{' '}
          {MAX_REPORT_MONTHS}.
        </Text>

        <Text style={styles.sectionLabel}>Currencies in the file</Text>
        {availableCurrencies.length === 0 ? (
          <Text style={styles.muted}>{loading ? 'Loading…' : 'None in this range.'}</Text>
        ) : (
          availableCurrencies.map((code) => {
            const on = !skipped.includes(code);
            return (
              <View key={code} style={styles.switchRow}>
                <Text style={styles.switchTitle}>{code}</Text>
                <Switch
                  {...switchProps(on)}
                  onValueChange={(v) => toggleCurrency(code, v)}
                  accessibilityLabel={`Include ${code}`}
                />
              </View>
            );
          })
        )}

        <View style={[styles.switchRow, styles.breakdownRow]}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>Break down by category</Text>
            <Text style={styles.switchHint}>
              Adds the category names you typed. Check them before sharing.
            </Text>
          </View>
          <Switch
            {...switchProps(breakdown)}
            onValueChange={setBreakdown}
            accessibilityLabel="Break down by category"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preview</Text>
          
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadError ? (
            <Text style={styles.error}>{loadError}</Text>
          ) : emptyReason ? (
            <Text style={styles.muted}>{emptyReason}</Text>
          ) : (
            <>
              {preview.summary.map((s) => (
                <View key={`${s.month}\0${s.currency}`} style={styles.previewRow}>
                  <View style={styles.previewHead}>
                    <Text style={styles.previewMonth}>
                      {s.month} · {s.currency}
                      {s.month === currentMonthKey ? ' (so far)' : ''}
                    </Text>
                    <Text style={styles.previewNet}>net {s.net}</Text>
                  </View>
                  <Text style={styles.previewDetail}>
                    income {s.income} · expense {s.expense}
                  </Text>
                </View>
              ))}
              {breakdown ? (
                <Text style={styles.previewNote}>
                  {preview.categoryCount === 0
                    ? 'No category names in this range.'
                    : `${preview.categoryCount} category ${preview.categoryCount === 1 ? 'name' : 'names'} in the file.`}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <Text style={styles.warning}>
          The file is not encrypted. Anyone who gets it can read it.
        </Text>
        <Pressable
          style={[styles.primaryBtn, !canExport && styles.btnDim]}
          onPress={confirmExport}
          disabled={!canExport}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canExport, busy }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Export CSV</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWithFooter>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    inner: { paddingVertical: 16, paddingHorizontal: 12, paddingBottom: 40 },
    lead: { fontSize: 14, color: c.textMuted, lineHeight: 21, marginBottom: 16 },
    fields: { gap: 4 },
    hint: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginTop: 8 },
    muted: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
    error: { fontSize: 14, color: c.danger, lineHeight: 20 },
    sectionLabel: { fontFamily: font.semibold, fontSize: 13, color: c.textMuted, marginTop: 20, marginBottom: 8 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 8,
      justifyContent: 'space-between',
    },
    breakdownRow: { marginTop: 12, alignItems: 'flex-start', paddingVertical: 14 },
    switchTextCol: { flex: 1 },
    switchTitle: { fontFamily: font.semibold, fontSize: 16, color: c.text },
    switchHint: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginTop: 6 },
    card: {
      marginTop: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: { fontFamily: font.bold, fontSize: 17, color: c.text, marginBottom: 8 },
    loading: { height: 80, justifyContent: 'center', alignItems: 'center' },
    previewRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
    previewHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    previewMonth: { flexShrink: 1, fontFamily: font.semibold, fontSize: 14, color: c.text },
    previewNet: { fontFamily: font.semibold, fontSize: 14, color: c.text },
    previewDetail: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginTop: 2 },
    previewNote: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginTop: 10 },
    warning: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginTop: 16, marginBottom: 8 },
    primaryBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    primaryBtnText: { color: c.onPrimary, fontFamily: font.semibold, fontSize: 16 },
    btnDim: { opacity: 0.45 },
  });
}
