// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ContourOnPrimaryText } from '../components/ContourOnPrimaryText';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import * as jarAdvancedRepo from '../db/repositories/jarAdvanced';
import * as jarRepo from '../db/repositories/jar';
import * as pocketsRepo from '../db/repositories/pockets';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorToAmountString, parseAmountStringToMinor } from '../utils/amountMinor';

const TOTAL_BPS = 10_000;

function parsePercentToBps(s) {
  const t = String(s).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

function bpsToDisplay(bps) {
  return (bps / 100).toFixed(2).replace(/\.?0+$/, '');
}

function equalBpsForRows(n) {
  if (n <= 0) return [];
  const base = Math.floor(TOTAL_BPS / n);
  const out = Array(n).fill(base);
  let rem = TOTAL_BPS - base * n;
  for (let i = 0; i < rem; i++) {
    out[i] += 1;
  }
  return out;
}

/** Default ceiling: empty or all zeros → 0 minor. */
function parseCeilingMinorString(raw) {
  const t = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '' || /^0+(\.0*)?$/.test(t)) {
    return 0;
  }
  return parseAmountStringToMinor(t);
}

function rowsFromRules(rules, pocketById) {
  return rules.map((r) => ({
    pocketId: r.target_pocket_id,
    name: pocketById.get(r.target_pocket_id) ?? r.target_pocket_name ?? '?',
    percentStr: bpsToDisplay(r.percent_bps),
  }));
}

function sumBpsForRows(rows) {
  let sum = 0;
  let valid = true;
  for (const r of rows) {
    const b = parsePercentToBps(r.percentStr);
    if (b === null) {
      valid = false;
      continue;
    }
    sum += b;
  }
  return { sum, valid, ok: valid && sum === TOTAL_BPS };
}

export default function JarAdvancedAssetEditor({ navigation, route }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createEditorStyles(colors), [colors]);
  const currency = route.params?.currency?.trim().toUpperCase() ?? '';

  const [ceilingStr, setCeilingStr] = useState('0');
  const [defaultRows, setDefaultRows] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [available, setAvailable] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!currency) {
      setLoaded(true);
      return;
    }
    const regular = await pocketsRepo.listRegularPockets();
    setAvailable(regular);
    const pocketById = new Map(regular.map((p) => [p.id, p.name]));

    const detail = await jarAdvancedRepo.getJarAdvancedAssetDetail(currency);
    if (detail) {
      setCeilingStr(formatMinorToAmountString(detail.defaultCeilingMinor));
      setDefaultRows(rowsFromRules(detail.defaultSplits, pocketById));
      setMilestones(
        detail.milestones.map((m) => ({
          localKey: m.id,
          thresholdStr: formatMinorToAmountString(m.thresholdMinor),
          rows: rowsFromRules(m.splits, pocketById),
        }))
      );
    } else {
      setCeilingStr('0');
      const basic = await jarRepo.listJarDistributionRules();
      if (basic.length > 0) {
        setDefaultRows(rowsFromRules(basic, pocketById));
      } else {
        setDefaultRows([]);
      }
      setMilestones([]);
    }
    setLoaded(true);
  }, [currency]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const defaultTotal = useMemo(() => sumBpsForRows(defaultRows), [defaultRows]);
  const milestonesAllValid = useMemo(
    () => milestones.every((m) => sumBpsForRows(m.rows).ok),
    [milestones]
  );

  const openPickerForDefault = () => {
    setPickerTarget({ kind: 'default' });
    setPickerOpen(true);
  };

  const openPickerForMilestone = (idx) => {
    setPickerTarget({ kind: 'milestone', index: idx });
    setPickerOpen(true);
  };

  const addPocketToTarget = (p) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === 'default') {
      setDefaultRows((prev) => [...prev, { pocketId: p.id, name: p.name, percentStr: '' }]);
    } else {
      const i = pickerTarget.index;
      setMilestones((prev) =>
        prev.map((m, j) =>
          j === i ? { ...m, rows: [...m.rows, { pocketId: p.id, name: p.name, percentStr: '' }] } : m
        )
      );
    }
    setPickerOpen(false);
    setPickerTarget(null);
  };

  const notInDefault = useMemo(() => {
    const ids = new Set(defaultRows.map((r) => r.pocketId));
    return available.filter((p) => !ids.has(p.id));
  }, [available, defaultRows]);

  const notInMilestone = useCallback(
    (idx) => {
      const ids = new Set(milestones[idx]?.rows.map((r) => r.pocketId) ?? []);
      return available.filter((p) => !ids.has(p.id));
    },
    [available, milestones]
  );

  const pickerChoices = useMemo(() => {
    if (!pickerTarget) return [];
    if (pickerTarget.kind === 'default') return notInDefault;
    return notInMilestone(pickerTarget.index);
  }, [pickerTarget, notInDefault, notInMilestone]);

  const addMilestone = () => {
    const key = `new-${Date.now()}`;
    setMilestones((prev) => [
      ...prev,
      {
        localKey: key,
        thresholdStr: '',
        rows: defaultRows.map((r) => ({ ...r, percentStr: r.percentStr })),
      },
    ]);
  };

  const removeMilestone = (idx) => {
    setMilestones((prev) => prev.filter((_, j) => j !== idx));
  };

  const updateMilestoneThreshold = (idx, text) => {
    setMilestones((prev) => prev.map((m, j) => (j === idx ? { ...m, thresholdStr: text } : m)));
  };

  const splitEvenlyDefault = () => {
    if (defaultRows.length === 0) return;
    const bps = equalBpsForRows(defaultRows.length);
    setDefaultRows((prev) => prev.map((r, i) => ({ ...r, percentStr: bpsToDisplay(bps[i]) })));
  };

  const splitEvenlyMilestone = (idx) => {
    setMilestones((prev) =>
      prev.map((m, j) => {
        if (j !== idx || m.rows.length === 0) return m;
        const bps = equalBpsForRows(m.rows.length);
        return {
          ...m,
          rows: m.rows.map((r, i) => ({ ...r, percentStr: bpsToDisplay(bps[i]) })),
        };
      })
    );
  };

  const save = async () => {
    if (!currency) return;
    let defaultCeilingMinor;
    try {
      defaultCeilingMinor = parseCeilingMinorString(ceilingStr);
    } catch (e) {
      Alert.alert('Ceiling', e instanceof Error ? e.message : String(e));
      return;
    }

    const defSplits = buildSplitsFromRows(defaultRows, 'Default split');
    if (!defSplits.ok) return;

    const milestonePayload = [];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      let thresholdMinor;
      try {
        thresholdMinor = parseAmountStringToMinor(m.thresholdStr);
      } catch (e) {
        Alert.alert(`Milestone ${i + 1}`, e instanceof Error ? e.message : String(e));
        return;
      }
      if (thresholdMinor <= defaultCeilingMinor) {
        Alert.alert(
          `Milestone ${i + 1}`,
          'Threshold must be greater than the default ceiling amount.'
        );
        return;
      }
      const spl = buildSplitsFromRows(m.rows, `Milestone ${i + 1}`);
      if (!spl.ok) return;
      milestonePayload.push({ thresholdMinor, splits: spl.entries });
    }

    const th = milestonePayload.map((x) => x.thresholdMinor);
    const sorted = [...th].sort((a, b) => a - b);
    for (let i = 0; i < th.length; i++) {
      if (sorted[i] !== th[i]) {
        Alert.alert('Order', 'List milestones in ascending order of threshold amounts.');
        return;
      }
      if (i > 0 && th[i] === th[i - 1]) {
        Alert.alert('Milestones', 'Each milestone threshold must be unique.');
        return;
      }
    }

    setBusy(true);
    try {
      await jarAdvancedRepo.saveJarAdvancedAsset({
        currency,
        defaultCeilingMinor,
        defaultSplits: defSplits.entries,
        milestones: milestonePayload,
      });
      Alert.alert('Saved', `Advanced rules for ${currency} are updated.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  function buildSplitsFromRows(rows, label) {
    if (rows.length === 0) {
      Alert.alert(label, 'Add at least one pocket.');
      return { ok: false };
    }
    const entries = [];
    for (const r of rows) {
      const bps = parsePercentToBps(r.percentStr);
      if (bps === null || bps <= 0) {
        Alert.alert(label, `Enter a value between 0.01 and 100 for ${r.name}.`);
        return { ok: false };
      }
      entries.push({ target_pocket_id: r.pocketId, percent_bps: bps });
    }
    const sum = entries.reduce((a, e) => a + e.percent_bps, 0);
    if (sum !== TOTAL_BPS) {
      Alert.alert(
        label,
        `Percentages must total 100% (currently ${(sum / 100).toFixed(2)}%).`
      );
      return { ok: false };
    }
    return { ok: true, entries };
  }

  if (!currency) {
    return (
      <ScreenWithFooter>
        <View style={styles.centered}>
          <Text style={styles.muted}>Missing asset.</Text>
        </View>
      </ScreenWithFooter>
    );
  }

  if (!loaded) {
    return (
      <ScreenWithFooter>
        <View style={styles.centered} />
      </ScreenWithFooter>
    );
  }

  return (
    <ScreenWithFooter>
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.sectionLabel}>Default ceiling</Text>
        <Text style={styles.hint}>
          While the Jar balance in {currency} is at or below this amount, the default split below
          applies in full. Above it, percentages blend toward milestones (or the basic split if you
          leave milestones empty).
        </Text>
        <TextInput
          style={styles.input}
          value={ceilingStr}
          onChangeText={setCeilingStr}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.placeholder}
        />

        <Text style={[styles.sectionLabel, styles.mt]}>Default split (at or below ceiling)</Text>
        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={openPickerForDefault} disabled={notInDefault.length === 0}>
            <Text style={styles.toolBtnText}>+ Pocket</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={splitEvenlyDefault} disabled={defaultRows.length < 2}>
            <Text style={styles.toolBtnText}>Split evenly</Text>
          </Pressable>
        </View>
        {renderSplitSection(defaultRows, setDefaultRows)}
        <SegmentTotalBar total={defaultTotal} barStyles={styles} />

        <View style={styles.mileHeaderRow}>
          <Text style={[styles.sectionLabel, styles.mtMb0]}>Milestones</Text>
          <Pressable style={styles.smallAdd} onPress={addMilestone}>
            <Text style={styles.smallAddText}>+ Add</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Optional. When the balance is between the ceiling and the first milestone, splits
          interpolate. Above the last milestone, the last milestone split stays flat.
        </Text>

        {milestones.map((m, idx) => (
          <View key={m.localKey} style={styles.milestoneCard}>
            <View style={styles.mileTop}>
              <Text style={styles.mileTitle}>Milestone {idx + 1}</Text>
              <Pressable onPress={() => removeMilestone(idx)} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <Text style={styles.subLabel}>Threshold balance ({currency})</Text>
            <TextInput
              style={styles.input}
              value={m.thresholdStr}
              onChangeText={(t) => updateMilestoneThreshold(idx, t)}
              keyboardType="decimal-pad"
              placeholder="Amount in Jar"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.toolbar}>
              <Pressable
                style={styles.toolBtn}
                onPress={() => openPickerForMilestone(idx)}
                disabled={notInMilestone(idx).length === 0}
              >
                <Text style={styles.toolBtnText}>+ Pocket</Text>
              </Pressable>
              <Pressable
                style={styles.toolBtn}
                onPress={() => splitEvenlyMilestone(idx)}
                disabled={m.rows.length < 2}
              >
                <Text style={styles.toolBtnText}>Split evenly</Text>
              </Pressable>
            </View>
            {renderMilestoneRows(idx, m.rows)}
            <SegmentTotalBar total={sumBpsForRows(m.rows)} barStyles={styles} />
          </View>
        ))}

        <Pressable
          style={[
            styles.saveBtn,
            (!defaultTotal.ok || !milestonesAllValid || busy) && styles.saveDisabled,
          ]}
          onPress={() => void save()}
          disabled={!defaultTotal.ok || !milestonesAllValid || busy}
        >
          <ContourOnPrimaryText style={styles.saveBtnText}>Save</ContourOnPrimaryText>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add pocket</Text>
            <FlatList
              data={pickerChoices}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable style={styles.pickerRow} onPress={() => addPocketToTarget(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>All pockets are in this split.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </ScreenWithFooter>
  );

  function renderSplitSection(rows, setRows) {
    if (rows.length === 0) {
      return <Text style={styles.muted}>Add at least one pocket.</Text>;
    }
    return (
      <>
        {rows.map((r) => (
          <View key={r.pocketId} style={styles.rowCard}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>
                {r.name}
              </Text>
              <Pressable
                onPress={() => setRows((prev) => prev.filter((x) => x.pocketId !== r.pocketId))}
                hitSlop={12}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <View style={styles.rowInputWrap}>
              <TextInput
                style={styles.rowInput}
                value={r.percentStr}
                onChangeText={(t) =>
                  setRows((prev) =>
                    prev.map((x) => (x.pocketId === r.pocketId ? { ...x, percentStr: t } : x))
                  )
                }
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={styles.pctSuffix}>%</Text>
            </View>
          </View>
        ))}
      </>
    );
  }

  function renderMilestoneRows(idx, rows) {
    const setMilestoneRows = (fn) => {
      setMilestones((prev) =>
        prev.map((m, j) => (j === idx ? { ...m, rows: fn(m.rows) } : m))
      );
    };
    return renderSplitSection(rows, setMilestoneRows);
  }
}

function SegmentTotalBar({ total, barStyles }) {
  const fillPct = total.sum / 100;
  const barPct = Math.min(100, Math.max(0, fillPct));
  const s = barStyles;
  return (
    <View style={s.totalCard}>
      <View style={s.totalTop}>
        <Text style={s.totalLabel}>Segment total</Text>
        <Text style={[s.totalValue, total.ok && s.totalOk]}>
          {total.valid ? `${fillPct.toFixed(2)}%` : '—'}
        </Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${barPct}%` }]} />
      </View>
      {!total.ok && total.valid ? (
        <Text style={s.totalWarn}>Adjust to reach 100.00%</Text>
      ) : null}
    </View>
  );
}

function createEditorStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 20, paddingBottom: 40 },
    centered: { flex: 1, backgroundColor: c.bg },
    muted: { color: c.textMuted, textAlign: 'center', marginVertical: 12 },
    sectionLabel: { fontFamily: font.semibold, fontSize: 16, color: c.text, marginBottom: 8 },
    subLabel: { fontSize: 13, color: c.textMuted, marginBottom: 6 },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 10 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.inputText,
    },
    mt: { marginTop: 20 },
    mtMb0: { marginTop: 20, marginBottom: 0 },
    mileHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    smallAdd: { paddingVertical: 6, paddingHorizontal: 10 },
    smallAddText: { color: c.primary, fontFamily: font.semibold, fontSize: 15 },
    toolbar: { flexDirection: 'row', gap: 10, marginBottom: 12, marginTop: 8 },
    toolBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
    },
    toolBtnText: { fontFamily: font.semibold, color: c.textSecondary, fontSize: 14 },
    milestoneCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    mileTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    mileTitle: { fontFamily: font.bold, fontSize: 16, color: c.text },
    rowCard: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rowName: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: c.text, marginRight: 12 },
    remove: { color: c.danger, fontSize: 14 },
    rowInputWrap: { flexDirection: 'row', alignItems: 'center' },
    rowInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: font.semibold,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    pctSuffix: { marginLeft: 8, fontSize: 16, fontFamily: font.semibold, color: c.textMuted },
    totalCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    totalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: 13, color: c.textMuted, fontFamily: font.semibold },
    totalValue: { fontSize: 18, fontFamily: font.bold, color: c.danger },
    totalOk: { color: c.success },
    totalWarn: { marginTop: 6, fontSize: 12, color: c.danger },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.barTrack,
      marginTop: 10,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: c.primary, maxWidth: '100%' },
    saveBtn: {
      marginTop: 8,
      backgroundColor: c.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    saveDisabled: { opacity: 0.45 },
    saveBtnText: { fontFamily: font.bold, fontSize: 17 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'center',
      padding: 24,
    },
    modalBox: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: { fontSize: 18, fontFamily: font.bold, marginBottom: 12, color: c.text },
    pickerList: { maxHeight: 280 },
    pickerRow: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 8,
      backgroundColor: c.pocketPickBg,
      borderWidth: 1,
      borderColor: c.pocketPickBorder,
    },
    pickerName: { fontSize: 16, color: c.pocketPickText },
    modalClose: { marginTop: 12, alignItems: 'center', padding: 8 },
    modalCloseText: { color: c.textMuted, fontFamily: font.semibold },
  });
}
