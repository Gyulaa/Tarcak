// @ts-nocheck
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const types = await assetTypesRepo.listAssetTypes();
        setAssetTypes(types);
        const c = await settingsRepo.getDefaultCurrency();
        setDefaultCode(c);
        setLoaded(true);
      })();
    }, [])
  );

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
  lockRow: { paddingVertical: 8 },
  lockText: { fontSize: 17, fontFamily: font.semibold, color: '#b00020' },
  lockHint: { color: '#666', marginTop: 6, fontSize: 13 },
});
