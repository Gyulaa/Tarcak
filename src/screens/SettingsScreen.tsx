// @ts-nocheck
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import * as settingsRepo from '../db/repositories/settings';
import { useLockVault } from '../navigation/LockVaultContext';
import { font } from '../theme/fonts';

export default function SettingsScreen() {
  const lockVault = useLockVault();
  const [code, setCode] = useState('HUF');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const c = await settingsRepo.getDefaultCurrency();
        setCode(c);
        setLoaded(true);
      })();
    }, [])
  );

  const save = async () => {
    try {
      const trimmed = code.trim().toUpperCase();
      if (trimmed.length < 3) {
        throw new Error('Use a 3+ letter currency code (e.g. HUF, USD).');
      }
      await settingsRepo.setDefaultCurrency(trimmed);
      Alert.alert('Saved', `New transactions will default to ${trimmed}.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.p}>
        Default currency is used when you open the transaction form (you can still change it per
        entry).
      </Text>
      <Text style={styles.label}>Currency code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        editable={loaded}
      />
      <Pressable style={styles.btn} onPress={() => void save()} disabled={!loaded}>
        <Text style={styles.btnText}>Save</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.lockRow} onPress={() => void lockVault()}>
        <Text style={styles.lockText}>Lock vault</Text>
        <Text style={styles.lockHint}>Closes the database and clears keys from memory.</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  p: { color: '#444', marginBottom: 16, lineHeight: 22 },
  label: { fontFamily: font.semibold, marginBottom: 6, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#ff6f32',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontFamily: font.semibold, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 28 },
  lockRow: { paddingVertical: 8 },
  lockText: { fontSize: 17, fontFamily: font.semibold, color: '#b00020' },
  lockHint: { color: '#666', marginTop: 6, fontSize: 13 },
});
