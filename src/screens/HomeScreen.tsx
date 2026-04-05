// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { useLockVault } from '../navigation/LockVaultContext';
import { useLedgerStore } from '../stores/ledgerStore';

export default function HomeScreen({ navigation }) {
  const lockVault = useLockVault();
  const pockets = useLedgerStore((s) => s.pockets);
  const homeBalances = useLedgerStore((s) => s.homeBalances);
  const refresh = useLedgerStore((s) => s.refresh);
  const loading = useLedgerStore((s) => s.loading);
  const lastError = useLedgerStore((s) => s.lastError);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => void lockVault()} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.headerBtnText}>Lock</Text>
        </Pressable>
      ),
    });
  }, [navigation, lockVault]);

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Assets by currency</Text>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      {loading && homeBalances.length === 0 ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : homeBalances.length === 0 ? (
        <Text style={styles.muted}>No transactions yet. Record income or add a pocket.</Text>
      ) : (
        <FlatList
          data={homeBalances}
          keyExtractor={(item) => item.currency}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.currency}>{item.currency}</Text>
              <Text style={styles.amount}>{formatMinorForDisplay(item.balance_minor, item.currency)}</Text>
            </View>
          )}
        />
      )}

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Pockets')}>
          <Text style={styles.primaryBtnText}>Pockets ({pockets.length})</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('History', {})}>
          <Text style={styles.secondaryBtnText}>History</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('TransactionEditor', { presetKind: 'income' })}
        >
          <Text style={styles.secondaryBtnText}>New transaction</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.secondaryBtnText}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  section: { fontSize: 16, fontFamily: font.semibold, marginBottom: 8, color: '#111' },
  muted: { color: '#666', marginBottom: 8 },
  error: { color: '#b00020', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  currency: { fontFamily: font.semibold, color: '#222' },
  amount: { color: '#333' },
  actions: { marginTop: 20, gap: 10 },
  primaryBtn: {
    backgroundColor: '#ff6f32',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontFamily: font.semibold, fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  secondaryBtnText: { color: '#ff6f32', fontFamily: font.semibold },
  headerBtn: { marginRight: 8, padding: 6 },
  headerBtnText: { color: '#ff6f32', fontFamily: font.semibold, fontSize: 16 },
});
