// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PocketEditMenu, PocketEditPencilButton } from '../components/PocketEditMenu';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { useLedgerStore } from '../stores/ledgerStore';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';

export default function PocketDetailScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pocketId } = route.params;
  const refreshLedger = useLedgerStore((s) => s.refresh);
  const [pocketName, setPocketName] = useState('');
  const [isJar, setIsJar] = useState(false);
  const [pocketArchived, setPocketArchived] = useState(false);
  const [balances, setBalances] = useState([]);
  const [txs, setTxs] = useState([]);
  const [txnCount, setTxnCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jarFeaturesOn, setJarFeaturesOn] = useState(true);
  const [editMenuVisible, setEditMenuVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, jarOn, n, b, t] = await Promise.all([
        pocketsRepo.getPocket(pocketId),
        settingsRepo.getJarEnabled(),
        pocketsRepo.countTransactionsForPocket(pocketId),
        txRepo.sumBalancesForPocket(pocketId),
        txRepo.listTransactions({ pocketId, limit: 80 }),
      ]);
      setJarFeaturesOn(jarOn);
      setPocketName(p?.name ?? 'Pocket');
      setIsJar(!!p?.is_jar);
      setPocketArchived(!!p?.archived);
      setTxnCount(n);
      setBalances(b);
      setTxs(t);
    } finally {
      setLoading(false);
    }
  }, [pocketId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const editMenuPocket = useMemo(
    () =>
      pocketId
        ? {
            id: pocketId,
            name: pocketName || 'Pocket',
            is_jar: isJar,
            archived: pocketArchived,
          }
        : null,
    [pocketId, pocketName, isJar, pocketArchived]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: pocketName || 'Pocket',
      headerRight:
        loading && !pocketName
          ? undefined
          : () => (
              <View style={{ marginRight: 6 }}>
                <PocketEditPencilButton
                  colors={colors}
                  onPress={() => setEditMenuVisible(true)}
                />
              </View>
            ),
    });
  }, [navigation, pocketName, loading, colors]);

  const showTxActions = !pocketArchived;

  const header = (
    <View>
      {pocketArchived ? (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedTitle}>Archived</Text>
          <Text style={styles.archivedSub}>
            {isJar
              ? 'Hidden from pocket lists and new transactions. Enable Pool & distribute under Settings to restore the Jar.'
              : 'Hidden from Pockets and pickers unless you enable Show archived pockets in Settings. History is unchanged.'}
          </Text>
        </View>
      ) : null}
      {isJar && jarFeaturesOn && !pocketArchived ? (
        <Pressable style={styles.jarBanner} onPress={() => navigation.navigate('Jar')}>
          <Text style={styles.jarBannerTitle}>This is your Jar</Text>
          <Text style={styles.jarBannerSub}>Distribute pooled funds from the Jar screen →</Text>
        </Pressable>
      ) : null}
      <Text style={styles.section}>Balances</Text>
      {balances.length === 0 ? (
        <Text style={styles.muted}>
          {txnCount > 0
            ? 'All assets net to zero in this pocket.'
            : 'No activity in this pocket yet.'}
        </Text>
      ) : (
        balances.map((item) => (
          <View key={item.currency} style={styles.row}>
            <Text style={styles.currency}>{item.currency}</Text>
            <Text style={styles.balanceAmt}>{formatMinorForDisplay(item.balance_minor, item.currency)}</Text>
          </View>
        ))
      )}

      <View style={styles.actions}>
        {showTxActions ? (
          <>
            <Pressable
              style={styles.btn}
              onPress={() =>
                navigation.navigate('TransactionEditor', { presetKind: 'income', pocketId })
              }
            >
              <Text style={styles.btnText}>Income</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() =>
                navigation.navigate('TransactionEditor', { presetKind: 'expense', pocketId })
              }
            >
              <Text style={styles.btnText}>Expense</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() =>
                navigation.navigate('TransactionEditor', { presetKind: 'transfer', fromPocketId: pocketId })
              }
            >
              <Text style={styles.btnText}>Transfer</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          style={styles.outline}
          onPress={() => navigation.navigate('History', { pocketId })}
        >
          <Text style={styles.outlineText}>History (this pocket)</Text>
        </Pressable>
      </View>

      <Text style={[styles.section, styles.recentTitle]}>Recent</Text>
    </View>
  );

  if (loading && !pocketName) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.listFlex}
        contentContainerStyle={styles.listPad}
        data={txs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.muted}>No transactions.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.txRow}
            onPress={() => navigation.navigate('TransactionEditor', { transactionId: item.id })}
          >
            <Text style={styles.txDate}>{formatOccurredAt(item.occurred_at)}</Text>
            <Text style={styles.txTitle}>{item.title}</Text>
            <Text style={styles.txMeta}>
              {item.kind} · {item.currency} · {formatMinorForDisplay(item.amount_minor, item.currency)}
            </Text>
          </Pressable>
        )}
      />

      <PocketEditMenu
        visible={editMenuVisible}
        pocket={editMenuPocket}
        onClose={() => setEditMenuVisible(false)}
        onMutated={async () => {
          await refreshLedger();
          await load();
        }}
        afterArchive={async () => {
          const show = await settingsRepo.getShowArchivedPockets();
          if (!show) {
            navigation.goBack();
          }
        }}
      />
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    listFlex: { flex: 1 },
    listPad: { padding: 16, paddingBottom: 32 },
    centered: { flex: 1, justifyContent: 'center', backgroundColor: c.bg },
    archivedBanner: {
      backgroundColor: c.archivedBg,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.archivedBorder,
    },
    archivedTitle: { fontFamily: font.bold, color: c.archivedTitle, fontSize: 14 },
    archivedSub: { color: c.archivedSub, fontSize: 13, marginTop: 6, lineHeight: 18 },
    jarBanner: {
      backgroundColor: c.jarSoftBg,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
    },
    jarBannerTitle: { fontFamily: font.bold, color: c.jarBannerTitle, fontSize: 15 },
    jarBannerSub: { color: c.jarHint, fontSize: 13, marginTop: 4 },
    section: { fontSize: 15, fontFamily: font.semibold, marginBottom: 8, color: c.text },
    recentTitle: { marginTop: 8 },
    muted: { color: c.textMuted, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    currency: { fontSize: 15, fontFamily: font.semibold, color: c.textSecondary },
    balanceAmt: { fontSize: 22, fontFamily: font.bold, color: c.text },
    actions: { marginVertical: 16, gap: 8 },
    btn: { backgroundColor: c.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    btnText: { color: c.onPrimary, fontFamily: font.semibold },
    outline: {
      borderWidth: 1,
      borderColor: c.primary,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    outlineText: { color: c.primary, fontFamily: font.semibold },
    txRow: {
      padding: 12,
      backgroundColor: c.surface,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    txDate: { fontSize: 12, color: c.textMuted, fontFamily: font.semibold, marginBottom: 4 },
    txTitle: { fontFamily: font.semibold, color: c.textSecondary },
    txMeta: { color: c.textMuted, fontSize: 13, marginTop: 4 },
  });
}
