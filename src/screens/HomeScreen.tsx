// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { DonationFooter } from '../components/DonationFooter';
import * as settingsRepo from '../db/repositories/settings';
import { useLockVault } from '../navigation/LockVaultContext';
import { useLedgerStore } from '../stores/ledgerStore';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorForDisplay } from '../utils/formatMinor';

export default function HomeScreen({ navigation }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  }, [navigation, lockVault, styles.headerBtn, styles.headerBtnText]);

  const listHeader = (
    <View>
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
      {loading && homeBalances.length === 0 ? <Text style={styles.muted}>Loading…</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        data={homeBalances}
        keyExtractor={(item) => item.currency}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading ? <Text style={styles.muted}>No transactions yet. Record income or add a pocket.</Text> : null
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.currency}>{item.currency}</Text>
            <Text style={styles.amount}>{formatMinorForDisplay(item.balance_minor, item.currency)}</Text>
          </View>
        )}
      />

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

      <DonationFooter />
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    jarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
      shadowColor: c.shadowJar,
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    jarCardText: { flex: 1 },
    jarKicker: { fontSize: 11, fontFamily: font.semibold, color: c.primary, letterSpacing: 0.6 },
    jarTitle: { fontSize: 18, fontFamily: font.bold, color: c.jarTitle, marginTop: 4 },
    jarSub: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    jarChevron: { fontSize: 28, color: c.primary, fontWeight: '300', marginLeft: 8 },
    section: { fontSize: 16, fontFamily: font.semibold, marginBottom: 8, color: c.text },
    muted: { color: c.textMuted, marginBottom: 8 },
    error: { color: c.danger, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    currency: { fontFamily: font.semibold, color: c.textSecondary },
    amount: { color: c.textSecondary },
    actions: { padding: 16, paddingTop: 8, paddingBottom: 4, gap: 10, backgroundColor: c.bg },
    primaryBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    primaryBtnText: { color: c.onPrimary, fontFamily: font.semibold, fontSize: 16 },
    secondaryBtn: {
      backgroundColor: c.surface,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    secondaryBtnText: { color: c.primary, fontFamily: font.semibold },
    headerBtn: { marginRight: 8, padding: 6 },
    headerBtnText: { color: c.primary, fontFamily: font.semibold, fontSize: 16 },
  });
}
