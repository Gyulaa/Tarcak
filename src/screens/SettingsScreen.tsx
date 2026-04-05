// @ts-nocheck
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';

import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as settingsRepo from '../db/repositories/settings';
import { useLockVault } from '../navigation/LockVaultContext';
import { font } from '../theme/fonts';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const lockVault = useLockVault();
  const [assetTypes, setAssetTypes] = useState([]);
  const [defaultCode, setDefaultCode] = useState('HUF');
  const [loaded, setLoaded] = useState(false);
  const [jarEnabled, setJarEnabled] = useState(true);
  const [advancedJarEnabled, setAdvancedJarEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const types = await assetTypesRepo.listAssetTypes();
        setAssetTypes(types);
        const c = await settingsRepo.getDefaultCurrency();
        setDefaultCode(c);
        setJarEnabled(await settingsRepo.getJarEnabled());
        setAdvancedJarEnabled(await settingsRepo.getAdvancedJarEnabled());
        setLoaded(true);
      })();
    }, [])
  );

  const onJarToggle = async (value) => {
    try {
      await settingsRepo.setJarEnabled(value);
      setJarEnabled(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const onAdvancedJarToggle = async (value) => {
    try {
      await settingsRepo.setAdvancedJarEnabled(value);
      setAdvancedJarEnabled(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    try {
      await settingsRepo.setDefaultCurrency(defaultCode);
      Alert.alert('Saved', `New transactions will default to ${defaultCode}.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.p}>
        Default asset type is selected when you open a new transaction. Create types under Asset
        types, then pick one here.
      </Text>
      <Text style={styles.label}>Default asset type</Text>
      <View style={styles.pickList}>
        {loaded && assetTypes.length === 0 ? (
          <Text style={styles.muted}>
            No asset types yet. Open Asset types below and add at least one (e.g. HUF).
          </Text>
        ) : (
          assetTypes.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.pick, defaultCode === a.code && styles.pickOn]}
              onPress={() => setDefaultCode(a.code)}
              disabled={!loaded}
            >
              <Text style={defaultCode === a.code ? styles.pickOnText : styles.pickCode}>{a.code}</Text>
              <Text style={styles.pickSub}>{a.name}</Text>
            </Pressable>
          ))
        )}
      </View>
      <Pressable style={styles.btn} onPress={() => void save()} disabled={!loaded || assetTypes.length === 0}>
        <Text style={styles.btnText}>Save default</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('AssetTypes')}>
        <Text style={styles.secondaryBtnText}>Asset types…</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.label}>Jar</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Pool & distribute</Text>
          <Text style={styles.switchHint}>
            Home shortcut, distribution, and the highlighted Jar row in Pockets. When off, the Jar
            pocket is archived: hidden from lists and from new transaction pickers until you turn this
            back on.
          </Text>
        </View>
        <Switch
          value={jarEnabled}
          onValueChange={(v) => void onJarToggle(v)}
          disabled={!loaded}
          trackColor={{ false: '#ddd', true: '#ffc4a8' }}
          thumbColor={jarEnabled ? '#ff6f32' : '#f4f4f4'}
        />
      </View>

      <View style={[styles.switchRow, !jarEnabled && styles.switchRowDim]}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Advanced Jar</Text>
          <Text style={styles.switchHint}>
            Per-asset default ceiling and milestone splits (linear blend between steps). Assets without
            their own rules still use the basic split from Jar → Edit split. Off by default.
          </Text>
        </View>
        <Switch
          value={advancedJarEnabled}
          onValueChange={(v) => void onAdvancedJarToggle(v)}
          disabled={!loaded || !jarEnabled}
          trackColor={{ false: '#ddd', true: '#ffc4a8' }}
          thumbColor={advancedJarEnabled ? '#ff6f32' : '#f4f4f4'}
        />
      </View>

      <Pressable
        style={[styles.secondaryBtn, (!jarEnabled || !advancedJarEnabled) && styles.secondaryBtnDim]}
        onPress={() => navigation.navigate('JarAdvanced')}
        disabled={!loaded || !jarEnabled || !advancedJarEnabled}
      >
        <Text style={styles.secondaryBtnText}>Configure Advanced Jar…</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.lockRow} onPress={() => void lockVault()}>
        <Text style={styles.lockText}>Lock vault</Text>
        <Text style={styles.lockHint}>Closes the database and clears keys from memory.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  inner: { padding: 16, paddingBottom: 40 },
  p: { color: '#444', marginBottom: 16, lineHeight: 22 },
  label: { fontFamily: font.semibold, marginBottom: 6, color: '#222' },
  pickList: { gap: 6, marginBottom: 16 },
  pick: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickOn: { borderColor: '#ff6f32', backgroundColor: '#fff0eb' },
  pickOnText: { fontFamily: font.semibold, color: '#ff6f32' },
  pickCode: { fontFamily: font.semibold, color: '#222' },
  pickSub: { fontSize: 13, color: '#666', marginTop: 2 },
  muted: { color: '#666', paddingVertical: 8 },
  btn: {
    backgroundColor: '#ff6f32',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontFamily: font.semibold, fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  secondaryBtnText: { color: '#ff6f32', fontFamily: font.semibold, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 28 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    marginBottom: 8,
  },
  switchTextCol: { flex: 1 },
  switchTitle: { fontFamily: font.semibold, fontSize: 16, color: '#222', marginBottom: 6 },
  switchHint: { fontSize: 13, color: '#666', lineHeight: 19 },
  switchRowDim: { opacity: 0.55 },
  secondaryBtnDim: { opacity: 0.45 },
  lockRow: { paddingVertical: 8 },
  lockText: { fontSize: 17, fontFamily: font.semibold, color: '#b00020' },
  lockHint: { color: '#666', marginTop: 6, fontSize: 13 },
});
