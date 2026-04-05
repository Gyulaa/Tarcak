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
  View,
} from 'react-native';

import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as jarAdvancedRepo from '../db/repositories/jarAdvanced';
import * as settingsRepo from '../db/repositories/settings';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorForDisplay } from '../utils/formatMinor';

export default function JarAdvancedHub({ navigation }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createHubStyles(colors), [colors]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jarOn, setJarOn] = useState(true);
  const [advancedOn, setAdvancedOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assetTypes, setAssetTypes] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, jar, adv, types] = await Promise.all([
        jarAdvancedRepo.listJarAdvancedSummaries(),
        settingsRepo.getJarEnabled(),
        settingsRepo.getAdvancedJarEnabled(),
        assetTypesRepo.listAssetTypes(),
      ]);
      setSummaries(sum);
      setJarOn(jar);
      setAdvancedOn(adv);
      setAssetTypes(types);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const codesInUse = useMemo(() => new Set(summaries.map((s) => s.currency)), [summaries]);
  const addableCodes = useMemo(
    () => assetTypes.filter((a) => !codesInUse.has(a.code)),
    [assetTypes, codesInUse]
  );

  const onDelete = (currency) => {
    Alert.alert(
      'Remove advanced config?',
      `Delete Advanced Jar rules for ${currency}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await jarAdvancedRepo.deleteJarAdvancedAsset(currency);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  if (!jarOn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Turn on Pool & distribute in Settings to use Advanced Jar.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (!advancedOn) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
        <Text style={styles.lead}>
          Advanced Jar is off. Enable it under Settings → Jar to configure per-asset ceilings and
          milestone splits.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.lead}>
          Each listed asset uses its own default split while the Jar balance stays at or below the
          ceiling, then blends toward milestone splits as the balance grows. Distribution from the
          Jar only runs for assets you configure here.
        </Text>

        <Pressable
          style={[styles.addBtn, addableCodes.length === 0 && styles.addBtnDisabled]}
          onPress={() => setPickerOpen(true)}
          disabled={addableCodes.length === 0}
        >
          <Text style={styles.addBtnText}>+ Add asset</Text>
        </Pressable>

        {addableCodes.length === 0 && assetTypes.length > 0 ? (
          <Text style={styles.mutedSmall}>Every asset type already has advanced rules.</Text>
        ) : null}

        {summaries.length === 0 ? (
          <Text style={styles.muted}>No per-asset rules yet. Add an asset to begin.</Text>
        ) : (
          summaries.map((s) => (
            <View key={s.id} style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => navigation.navigate('JarAdvancedAssetEditor', { currency: s.currency })}
              >
                <Text style={styles.rowCode}>{s.currency}</Text>
                <Text style={styles.rowSub}>
                  Ceiling {formatMinorForDisplay(s.defaultCeilingMinor, s.currency)} ·{' '}
                  {s.milestoneCount} milestone{s.milestoneCount === 1 ? '' : 's'}
                </Text>
              </Pressable>
              <Pressable style={styles.removeHit} onPress={() => onDelete(s.currency)} hitSlop={10}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose asset</Text>
            <FlatList
              data={addableCodes}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    setPickerOpen(false);
                    navigation.navigate('JarAdvancedAssetEditor', { currency: item.code });
                  }}
                >
                  <Text style={styles.pickerName}>{item.code}</Text>
                  <Text style={styles.pickerSub}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.muted}>Add asset types under Settings first.</Text>
              }
            />
            <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createHubStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 20, paddingBottom: 40 },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: c.bg,
    },
    lead: { fontSize: 15, color: c.textMuted, lineHeight: 22, marginBottom: 18 },
    muted: { color: c.textMuted, fontSize: 15, textAlign: 'center', marginTop: 12 },
    mutedSmall: { color: c.textMuted, fontSize: 13, marginBottom: 12 },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: c.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignSelf: 'center',
    },
    primaryBtnText: { color: c.onPrimary, fontFamily: font.semibold, fontSize: 16 },
    addBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 8,
    },
    addBtnDisabled: { opacity: 0.45 },
    addBtnText: { color: c.onPrimary, fontFamily: font.bold, fontSize: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 4,
      paddingLeft: 14,
      paddingRight: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowMain: { flex: 1, paddingVertical: 10 },
    rowCode: { fontFamily: font.bold, fontSize: 18, color: c.text },
    rowSub: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    removeHit: { paddingVertical: 8, paddingLeft: 12 },
    removeText: { color: c.danger, fontFamily: font.semibold, fontSize: 14 },
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
    pickerList: { maxHeight: 320 },
    pickerRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    pickerName: { fontFamily: font.bold, fontSize: 17, color: c.text },
    pickerSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    modalClose: { marginTop: 12, alignItems: 'center', padding: 8 },
    modalCloseText: { color: c.textMuted, fontFamily: font.semibold },
  });
}
