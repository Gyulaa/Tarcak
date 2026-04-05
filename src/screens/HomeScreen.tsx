// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import * as settingsRepo from '../db/repositories/settings';
import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { useLockVault } from '../navigation/LockVaultContext';
import { useLedgerStore } from '../stores/ledgerStore';

export default function HomeScreen({ navigation }) {
  const lockVault = useLockVault();
  const pockets = useLedgerStore((s) => s.pockets);
  const jarPocket = pockets.find((p) => p.is_jar);
  const pocketListCount = pockets.length;
  const homeBalances = useLedgerStore((s) => s.homeBalances);
  const refresh = useLedgerStore((s) => s.refresh);
  const loading = useLedgerStore((s) => s.loading);
  const lastError = useLedgerStore((s) => s.lastError);
  const [jarEnabled, setJarEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void (async () => {
        setJarEnabled(await settingsRepo.getJarEnabled());
      })();
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
      {jarPocket && jarEnabled ? (
        <Pressable style={styles.jarCard} onPress={() => navigation.navigate('Jar')}>
          <View style={styles.jarCardText}>
            <Text style={styles.jarKicker}>Pool of assets</Text>
            <Text style={styles.jarTitle}>{jarPocket.name}</Text>
            <Text style={styles.jarSub}>Hold income, then distribute to pockets</Text>
          </View>
          <Text style={styles.jarChevron}>›</Text>
        </Pressable>
      ) : null}

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
          <Text style={styles.primaryBtnText}>Pockets ({pocketListCount})</Text>
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
  jarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0e6e2',
    shadowColor: '#ff6f32',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  jarCardText: { flex: 1 },
  jarKicker: { fontSize: 11, fontFamily: font.semibold, color: '#ff6f32', letterSpacing: 0.6 },
  jarTitle: { fontSize: 18, fontFamily: font.bold, color: '#111', marginTop: 4 },
  jarSub: { fontSize: 13, color: '#666', marginTop: 4 },
  jarChevron: { fontSize: 28, color: '#ff6f32', fontWeight: '300', marginLeft: 8 },
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
