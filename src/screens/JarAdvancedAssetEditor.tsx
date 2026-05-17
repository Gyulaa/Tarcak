// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Crypto from 'expo-crypto';

import { ContourOnPrimaryText } from '../components/ContourOnPrimaryText';
import { JarAdvancedSplitBar } from '../components/jarAdvanced/JarAdvancedSplitBar';
import { JarAdvancedSplitEditor } from '../components/jarAdvanced/JarAdvancedSplitEditor';
import { JarAdvancedBalanceChart } from '../components/jarAdvanced/JarAdvancedBalanceChart';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import { effectiveSplitRowsAtBalance, suggestMilestoneBalance } from '../domain/jarAdvancedChartModel';
import {
  splitsSumExact100,
  splitsSumValid,
  type SplitRow,
} from '../domain/jarAdvancedEditorTypes';
import { validateEditorForSave } from '../domain/jarAdvancedEditorSave';
import * as jarAdvancedRepo from '../db/repositories/jarAdvanced';
import * as jarRepo from '../db/repositories/jar';
import * as pocketsRepo from '../db/repositories/pockets';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import {
  formatMinorToAmountString,
  parseAmountStringToMinor,
} from '../utils/amountMinor';
import { formatMinorForDisplay } from '../utils/formatMinor';

function parseCeilingMinorString(raw) {
  const t = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '' || /^0+(\.0*)?$/.test(t)) {
    return 0;
  }
  return parseAmountStringToMinor(t);
}

export default function JarAdvancedAssetEditor({ navigation, route }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createEditorStyles(colors), [colors]);
  const currency = route.params?.currency?.trim().toUpperCase() ?? '';

  const [ceilingStr, setCeilingStr] = useState('0');
  const [defaultSplits, setDefaultSplits] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [available, setAvailable] = useState([]);
  const [pocketById, setPocketById] = useState(() => new Map());
  const [selection, setSelection] = useState({ kind: 'edit', knotId: 'default' });
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
    const names = new Map(regular.map((p) => [p.id, p.name]));
    setPocketById(names);

    const detail = await jarAdvancedRepo.getJarAdvancedAssetDetail(currency);
    if (detail) {
      setCeilingStr(formatMinorToAmountString(detail.defaultCeilingMinor));
      setDefaultSplits(
        detail.defaultSplits.map((s) => ({
          pocketId: s.target_pocket_id,
          name: names.get(s.target_pocket_id) ?? '?',
          percent: s.percent_bps / 100,
        }))
      );
      setMilestones(
        detail.milestones.map((m) => ({
          id: m.id,
          thresholdMinor: m.thresholdMinor,
          thresholdStr: formatMinorToAmountString(m.thresholdMinor),
          splits: m.splits.map((s) => ({
            pocketId: s.target_pocket_id,
            name: names.get(s.target_pocket_id) ?? '?',
            percent: s.percent_bps / 100,
          })),
        }))
      );
    } else {
      setCeilingStr('0');
      const basic = await jarRepo.listJarDistributionRules();
      if (basic.length > 0) {
        setDefaultSplits(
          basic.map((r) => ({
            pocketId: r.target_pocket_id,
            name: names.get(r.target_pocket_id) ?? r.target_pocket_name ?? '?',
            percent: r.percent_bps / 100,
          }))
        );
      } else {
        setDefaultSplits([]);
      }
      setMilestones([]);
    }
    setSelection({ kind: 'edit', knotId: 'default' });
    setLoaded(true);
  }, [currency]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const editorCore = useMemo(
    () => ({
      currency,
      defaultCeilingMinor: (() => {
        try {
          return parseCeilingMinorString(ceilingStr);
        } catch {
          return 0;
        }
      })(),
      defaultSplits,
      milestones,
    }),
    [currency, ceilingStr, defaultSplits, milestones]
  );

  const previewBalanceMinor =
    selection.kind === 'preview' ? selection.balanceMinor : null;

  const displayRows = useMemo(() => {
    if (selection.kind === 'edit') {
      if (selection.knotId === 'default') {
        return defaultSplits;
      }
      const m = milestones.find((x) => x.id === selection.knotId);
      return m?.splits ?? [];
    }
    return effectiveSplitRowsAtBalance(editorCore, selection.balanceMinor, pocketById);
  }, [selection, defaultSplits, milestones, editorCore, pocketById]);

  const splitCaption = useMemo(() => {
    if (selection.kind === 'edit') {
      if (selection.knotId === 'default') {
        return `Editing: Default (up to ${formatMinorForDisplay(editorCore.defaultCeilingMinor, currency)})`;
      }
      const m = milestones.find((x) => x.id === selection.knotId);
      const idx = milestones.findIndex((x) => x.id === selection.knotId);
      if (m) {
        return `Editing: Milestone ${idx + 1} at ${formatMinorForDisplay(m.thresholdMinor, currency)}`;
      }
      return 'Editing';
    }
    return `Preview at ${formatMinorForDisplay(selection.balanceMinor, currency)} (automatic)`;
  }, [selection, milestones, editorCore.defaultCeilingMinor, currency]);

  const canSave =
    splitsSumValid(defaultSplits) &&
    milestones.every((m) => splitsSumValid(m.splits));

  const openPickerForCurrent = () => {
    if (selection.kind !== 'edit') return;
    setPickerTarget(selection.knotId);
    setPickerOpen(true);
  };

  const idsInCurrentEdit = useMemo(() => {
    if (selection.kind !== 'edit') return new Set();
    if (selection.knotId === 'default') {
      return new Set(defaultSplits.map((r) => r.pocketId));
    }
    const m = milestones.find((x) => x.id === selection.knotId);
    return new Set(m?.splits.map((r) => r.pocketId) ?? []);
  }, [selection, defaultSplits, milestones]);

  const pickerChoices = useMemo(
    () => available.filter((p) => !idsInCurrentEdit.has(p.id)),
    [available, idsInCurrentEdit]
  );

  const addPocketToCurrent = (p) => {
    if (selection.kind !== 'edit') return;
    const row = { pocketId: p.id, name: p.name, percent: 0 };
    if (selection.knotId === 'default') {
      setDefaultSplits((prev) => [...prev, row]);
    } else {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === selection.knotId
            ? { ...m, splits: [...m.splits, row] }
            : m
        )
      );
    }
    setPickerOpen(false);
  };

  const updateCurrentSplits = (rows) => {
    if (selection.kind !== 'edit') return;
    if (selection.knotId === 'default') {
      setDefaultSplits(rows);
    } else {
      setMilestones((prev) =>
        prev.map((m) => (m.id === selection.knotId ? { ...m, splits: rows } : m))
      );
    }
  };

  const addMilestone = () => {
    const previewBal = selection.kind === 'preview' ? selection.balanceMinor : undefined;
    const bal = suggestMilestoneBalance(editorCore, previewBal);
    let splits: SplitRow[];
    if (selection.kind === 'preview') {
      splits = effectiveSplitRowsAtBalance(editorCore, selection.balanceMinor, pocketById);
    } else if (milestones.length > 0) {
      const last = [...milestones].sort((a, b) => a.thresholdMinor - b.thresholdMinor).pop();
      splits = last?.splits.map((r) => ({ ...r })) ?? defaultSplits.map((r) => ({ ...r }));
    } else {
      splits = defaultSplits.map((r) => ({ ...r }));
    }
    const id = Crypto.randomUUID();
    const next = [
      ...milestones,
      {
        id,
        thresholdMinor: bal,
        thresholdStr: formatMinorToAmountString(bal),
        splits: splits.map((r) => ({ ...r })),
      },
    ];
    next.sort((a, b) => a.thresholdMinor - b.thresholdMinor);
    setMilestones(next);
    setSelection({ kind: 'edit', knotId: id });
  };

  const createMilestoneFromPreview = () => {
    if (selection.kind !== 'preview') return;
    addMilestone();
  };

  const removeSelectedMilestone = () => {
    if (selection.kind !== 'edit' || selection.knotId === 'default') return;
    Alert.alert('Remove milestone?', 'This cannot be undone until you save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setMilestones((prev) => prev.filter((m) => m.id !== selection.knotId));
          setSelection({ kind: 'edit', knotId: 'default' });
        },
      },
    ]);
  };

  const doSave = async (validated) => {
    setBusy(true);
    try {
      await jarAdvancedRepo.saveJarAdvancedAsset(validated.payload);
      Alert.alert('Saved', `Advanced rules for ${currency} are updated.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    let defaultCeilingMinor;
    try {
      defaultCeilingMinor = parseCeilingMinorString(ceilingStr);
    } catch (e) {
      Alert.alert('Ceiling', e instanceof Error ? e.message : String(e));
      return;
    }
    const milestonesForSave = milestones.map((m) => {
      try {
        const minor = parseAmountStringToMinor(m.thresholdStr);
        return { ...m, thresholdMinor: minor };
      } catch {
        return m;
      }
    });
    const validated = validateEditorForSave({
      currency,
      defaultCeilingMinor,
      defaultSplits,
      milestones: milestonesForSave,
    });
    if (!validated.ok) {
      Alert.alert('Cannot save', validated.message);
      return;
    }
    const anyPartial =
      !splitsSumExact100(defaultSplits) ||
      milestonesForSave.some((m) => !splitsSumExact100(m.splits));
    if (anyPartial) {
      Alert.alert(
        'Partial split',
        'One or more splits total less than 100%. The undistributed portion will stay in the Jar when you distribute.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => void doSave(validated) },
        ]
      );
      return;
    }
    void doSave(validated);
  };

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
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenWithFooter>
    );
  }

  const selectedMilestone =
    selection.kind === 'edit' && selection.knotId !== 'default'
      ? milestones.find((m) => m.id === selection.knotId)
      : null;

  return (
    <ScreenWithFooter>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.heroTitle}>{currency} · Advanced Jar</Text>
          <Text style={styles.heroSub}>How income splits as your Jar balance grows</Text>

          <JarAdvancedSplitBar
            caption={splitCaption}
            rows={displayRows}
            legendFormat={selection.kind === 'preview' ? 'amount' : 'percent'}
            amountBaseMinor={previewBalanceMinor ?? undefined}
            currency={currency}
          />

          <JarAdvancedBalanceChart
            currency={currency}
            defaultCeilingMinor={editorCore.defaultCeilingMinor}
            defaultSplits={defaultSplits}
            milestones={milestones}
            pocketNames={pocketById}
            selectedKnotId={selection.kind === 'edit' ? selection.knotId : null}
            previewBalanceMinor={previewBalanceMinor}
            onSelectKnot={(knotId) => setSelection({ kind: 'edit', knotId })}
            onPreviewBalance={(balanceMinor) => setSelection({ kind: 'preview', balanceMinor })}
            onAddMilestone={addMilestone}
          />

          <View style={styles.panel}>
            {selection.kind === 'preview' ? (
              <>
                <Text style={styles.panelTitle}>Automatic blend</Text>
                <Text style={styles.panelHint}>
                  Between milestones, Tarcak adjusts the split smoothly. You are only previewing
                  here — nothing changes until you add or edit a milestone.
                </Text>
                <JarAdvancedSplitEditor rows={displayRows} onChange={() => {}} readOnly />
                <Pressable style={styles.secondaryBtn} onPress={createMilestoneFromPreview}>
                  <Text style={styles.secondaryBtnText}>Use this split as new milestone</Text>
                </Pressable>
              </>
            ) : selection.knotId === 'default' ? (
              <>
                <Text style={styles.panelTitle}>Default zone</Text>
                <Text style={styles.panelHint}>
                  While the Jar balance is at or below the ceiling, this split applies.
                </Text>
                <Text style={styles.fieldLabel}>Ceiling amount ({currency})</Text>
                <TextInput
                  style={styles.input}
                  value={ceilingStr}
                  onChangeText={setCeilingStr}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
                <JarAdvancedSplitEditor
                  rows={defaultSplits}
                  onChange={setDefaultSplits}
                  onAddPocket={openPickerForCurrent}
                  addPocketDisabled={pickerChoices.length === 0}
                />
              </>
            ) : selectedMilestone ? (
              <>
                <Text style={styles.panelTitle}>Milestone</Text>
                <Text style={styles.fieldLabel}>Balance in Jar ({currency})</Text>
                <TextInput
                  style={styles.input}
                  value={selectedMilestone.thresholdStr}
                  onChangeText={(t) => {
                    setMilestones((prev) =>
                      prev.map((m) =>
                        m.id === selectedMilestone.id ? { ...m, thresholdStr: t } : m
                      )
                    );
                  }}
                  onBlur={() => {
                    try {
                      const minor = parseAmountStringToMinor(selectedMilestone.thresholdStr);
                      setMilestones((prev) =>
                        prev
                          .map((m) =>
                            m.id === selectedMilestone.id
                              ? { ...m, thresholdMinor: minor, thresholdStr: formatMinorToAmountString(minor) }
                              : m
                          )
                          .sort((a, b) => a.thresholdMinor - b.thresholdMinor)
                      );
                    } catch {
                      /* keep string until valid */
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.placeholder}
                />
                <JarAdvancedSplitEditor
                  rows={selectedMilestone.splits}
                  onChange={updateCurrentSplits}
                  onAddPocket={openPickerForCurrent}
                  addPocketDisabled={pickerChoices.length === 0}
                />
                <Pressable style={styles.dangerBtn} onPress={removeSelectedMilestone}>
                  <Text style={styles.dangerBtnText}>Remove milestone</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          <View style={styles.footerRow}>
            <Pressable style={styles.ghostBtn} onPress={() => navigation.goBack()} disabled={busy}>
              <Text style={styles.ghostBtnText}>Discard</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (!canSave || busy) && styles.saveDisabled]}
              onPress={() => void save()}
              disabled={!canSave || busy}
            >
              <ContourOnPrimaryText style={styles.saveBtnText}>Save</ContourOnPrimaryText>
            </Pressable>
          </View>
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
                  <Pressable style={styles.pickerRow} onPress={() => addPocketToCurrent(item)}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.muted}>All pockets are already listed.</Text>}
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
}

function createEditorStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 20, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
    muted: { color: c.textMuted, textAlign: 'center', marginVertical: 12 },
    heroTitle: { fontSize: 22, fontFamily: font.bold, color: c.text, marginBottom: 6 },
    heroSub: { fontSize: 15, color: c.textMuted, lineHeight: 22, marginBottom: 16 },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 20,
    },
    panelTitle: { fontFamily: font.bold, fontSize: 17, color: c.text, marginBottom: 8 },
    panelHint: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 14 },
    fieldLabel: { fontFamily: font.semibold, fontSize: 13, color: c.textMuted, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.inputText,
      marginBottom: 14,
    },
    secondaryBtn: {
      marginTop: 16,
      marginBottom: 4,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.primary,
    },
    secondaryBtnText: { color: c.primary, fontFamily: font.semibold, fontSize: 15 },
    dangerBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    dangerBtnText: { color: c.danger, fontFamily: font.semibold, fontSize: 15 },
    footerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    ghostBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    ghostBtnText: { color: c.textMuted, fontFamily: font.semibold, fontSize: 16 },
    saveBtn: {
      flex: 2,
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveDisabled: { opacity: 0.45 },
    saveBtnText: { fontFamily: font.bold, fontSize: 17 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'flex-end',
      padding: 16,
    },
    modalBox: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      maxHeight: '50%',
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: { fontFamily: font.bold, fontSize: 18, marginBottom: 12, color: c.text },
    pickerList: { maxHeight: 280 },
    pickerRow: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pickerName: { fontSize: 16, color: c.text },
    modalClose: { marginTop: 12, alignItems: 'center', padding: 10 },
    modalCloseText: { color: c.textMuted, fontFamily: font.semibold },
  });
}
