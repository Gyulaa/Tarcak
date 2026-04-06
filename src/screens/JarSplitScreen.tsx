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
import * as jarRepo from '../db/repositories/jar';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

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

export default function JarSplitScreen({ navigation }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSplitStyles(colors), [colors]);
  const [rows, setRows] = useState([]);
  const [available, setAvailable] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jarFeatureOn, setJarFeatureOn] = useState(true);
  const [advancedJarOn, setAdvancedJarOn] = useState(false);

  const load = useCallback(async () => {
    const regular = await pocketsRepo.listRegularPockets();
    setAvailable(regular);
    const rules = await jarRepo.listJarDistributionRules();
    if (rules.length > 0) {
      setRows(
        rules.map((r) => ({
          pocketId: r.target_pocket_id,
          name: r.target_pocket_name,
          percentStr: bpsToDisplay(r.percent_bps),
        }))
      );
    } else {
      setRows([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [on, adv] = await Promise.all([
          settingsRepo.getJarEnabled(),
          settingsRepo.getAdvancedJarEnabled(),
        ]);
        setJarFeatureOn(on);
        setAdvancedJarOn(adv);
        if (on) {
          void load();
        }
      })();
    }, [load])
  );

  const totalBps = useMemo(() => {
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
  }, [rows]);

  const notInRows = useMemo(() => {
    const ids = new Set(rows.map((r) => r.pocketId));
    return available.filter((p) => !ids.has(p.id));
  }, [available, rows]);

  const addPocket = (p) => {
    setRows((prev) => [...prev, { pocketId: p.id, name: p.name, percentStr: '' }]);
    setPickerOpen(false);
  };

  const removeRow = (pocketId) => {
    setRows((prev) => prev.filter((r) => r.pocketId !== pocketId));
  };

  const updatePercent = (pocketId, text) => {
    setRows((prev) =>
      prev.map((r) => (r.pocketId === pocketId ? { ...r, percentStr: text } : r))
    );
  };

  const splitEvenly = () => {
    if (rows.length === 0) return;
    const bps = equalBpsForRows(rows.length);
    setRows((prev) => prev.map((r, i) => ({ ...r, percentStr: bpsToDisplay(bps[i]) })));
  };

  const save = async () => {
    if (rows.length === 0) {
      Alert.alert('Add pockets', 'Choose at least one pocket to receive part of the Jar.');
      return;
    }
    const entries = [];
    for (const r of rows) {
      const bps = parsePercentToBps(r.percentStr);
      if (bps === null || bps <= 0) {
        Alert.alert('Check percentages', `Enter a value between 0.01 and 100 for ${r.name}.`);
        return;
      }
      entries.push({ target_pocket_id: r.pocketId, percent_bps: bps });
    }
    const sum = entries.reduce((a, e) => a + e.percent_bps, 0);
    if (sum !== TOTAL_BPS) {
      Alert.alert(
        'Must total 100%',
        `Current total is ${(sum / 100).toFixed(2)}%. Adjust the values so they add up to exactly 100%.`
      );
      return;
    }
    setBusy(true);
    try {
      await jarRepo.replaceJarDistributionRules(entries);
      Alert.alert('Saved', 'Your distribution split is updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fillPct = totalBps.sum / 100;
  const barPct = Math.min(100, Math.max(0, fillPct));
  const barWidth = `${barPct}%`;

  if (!jarFeatureOn) {
    return (
      <ScreenWithFooter>
      <View style={styles.root}>
        <View style={styles.disabledWrap}>
          <Text style={styles.disabledTitle}>Jar split is unavailable</Text>
          <Text style={styles.disabledBody}>
            Turn on "Pool & distribute" under Settings → Jar to edit distribution percentages.
          </Text>
          <Pressable style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <ContourOnPrimaryText style={styles.settingsBtnText}>Open Settings</ContourOnPrimaryText>
          </Pressable>
        </View>
      </View>
      </ScreenWithFooter>
    );
  }

  return (
    <ScreenWithFooter>
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.lead}>
          When you tap Distribute, each asset in the Jar is split across these pockets unless Advanced
          Jar overrides that asset. Percentages must add up to exactly 100%.
        </Text>
        {advancedJarOn ? (
          <Pressable style={styles.advLink} onPress={() => navigation.navigate('JarAdvanced')}>
            <Text style={styles.advLinkText}>Open Advanced Jar (per-asset ceilings & milestones)</Text>
          </Pressable>
        ) : null}

        <View style={styles.totalCard}>
          <View style={styles.totalTop}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, totalBps.ok && styles.totalOk]}>
              {totalBps.valid ? `${fillPct.toFixed(2)}%` : '—'}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: barWidth }]} />
          </View>
          {!totalBps.ok && totalBps.valid ? (
            <Text style={styles.totalWarn}>Adjust to reach 100.00%</Text>
          ) : null}
        </View>

        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={() => setPickerOpen(true)} disabled={notInRows.length === 0}>
            <Text style={styles.toolBtnText}>+ Add pocket</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={splitEvenly} disabled={rows.length < 2}>
            <Text style={styles.toolBtnText}>Split evenly</Text>
          </Pressable>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.muted}>No pockets yet. Create pockets first, then add them here.</Text>
        ) : (
          rows.map((r) => (
            <View key={r.pocketId} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Pressable onPress={() => removeRow(r.pocketId)} hitSlop={12}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
              <View style={styles.rowInputWrap}>
                <TextInput
                  style={styles.rowInput}
                  value={r.percentStr}
                  onChangeText={(t) => updatePercent(r.pocketId, t)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
                <Text style={styles.pctSuffix}>%</Text>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={[styles.saveBtn, (!totalBps.ok || busy || rows.length === 0) && styles.saveDisabled]}
          onPress={() => void save()}
          disabled={!totalBps.ok || busy || rows.length === 0}
        >
          <ContourOnPrimaryText style={styles.saveBtnText}>Save split</ContourOnPrimaryText>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add pocket</Text>
            <FlatList
              data={notInRows}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable style={styles.pickerRow} onPress={() => addPocket(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>All pockets are already in the split.</Text>}
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

function createSplitStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    disabledWrap: { padding: 24, paddingTop: 40 },
    disabledTitle: { fontSize: 20, fontFamily: font.bold, color: c.text, marginBottom: 10 },
    disabledBody: { fontSize: 15, color: c.textMuted, lineHeight: 22, marginBottom: 20 },
    settingsBtn: {
      alignSelf: 'flex-start',
      backgroundColor: c.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
    },
    settingsBtnText: { fontFamily: font.semibold, fontSize: 16 },
    inner: { padding: 20, paddingBottom: 40 },
    lead: { fontSize: 15, color: c.textMuted, lineHeight: 22, marginBottom: 12 },
    advLink: { marginBottom: 20, paddingVertical: 4 },
    advLinkText: { color: c.primary, fontFamily: font.semibold, fontSize: 15 },
    totalCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    totalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: 14, color: c.textMuted, fontFamily: font.semibold },
    totalValue: { fontSize: 22, fontFamily: font.bold, color: c.danger },
    totalOk: { color: c.success },
    totalWarn: { marginTop: 8, fontSize: 13, color: c.danger },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.barTrack,
      marginTop: 14,
      overflow: 'hidden',
    },
    barFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      maxWidth: '100%',
    },
    toolbar: { flexDirection: 'row', gap: 10, marginBottom: 16 },
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
    rowCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    rowName: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: c.text, marginRight: 12 },
    remove: { color: c.danger, fontSize: 14 },
    rowInputWrap: { flexDirection: 'row', alignItems: 'center' },
    rowInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      fontFamily: font.semibold,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    pctSuffix: { marginLeft: 10, fontSize: 18, fontFamily: font.semibold, color: c.textMuted },
    muted: { color: c.textMuted, textAlign: 'center', marginVertical: 16 },
    saveBtn: {
      marginTop: 20,
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
