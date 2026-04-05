// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';

export default function PocketDetailScreen({ navigation, route }) {
  const { pocketId } = route.params;
  const [pocketName, setPocketName] = useState('');
  const [isJar, setIsJar] = useState(false);
  const [pocketArchived, setPocketArchived] = useState(false);
  const [balances, setBalances] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jarFeaturesOn, setJarFeaturesOn] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, jarOn] = await Promise.all([
        pocketsRepo.getPocket(pocketId),
        settingsRepo.getJarEnabled(),
      ]);
      setJarFeaturesOn(jarOn);
      setPocketName(p?.name ?? 'Pocket');
      setIsJar(!!p?.is_jar);
      setPocketArchived(!!p?.archived);
      const b = await txRepo.sumBalancesForPocket(pocketId);
      setBalances(b);
      const t = await txRepo.listTransactions({ pocketId, limit: 80 });
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: pocketName || 'Pocket' });
  }, [navigation, pocketName]);

  const header = (
    <View>
      {pocketArchived ? (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedTitle}>Archived</Text>
          <Text style={styles.archivedSub}>
            {isJar
              ? 'Hidden from pocket lists and new transactions. Enable Pool & distribute under Settings to restore the Jar.'
              : 'This pocket is archived and hidden from normal lists.'}
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
        <Text style={styles.muted}>No activity in this pocket yet.</Text>
      ) : (
        balances.map((item) => (
          <View key={item.currency} style={styles.row}>
            <Text style={styles.currency}>{item.currency}</Text>
            <Text>{formatMinorForDisplay(item.balance_minor, item.currency)}</Text>
          </View>
        ))
      )}

      <View style={styles.actions}>
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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  listPad: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center' },
  archivedBanner: {
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  archivedTitle: { fontFamily: font.bold, color: '#52525b', fontSize: 14 },
  archivedSub: { color: '#71717a', fontSize: 13, marginTop: 6, lineHeight: 18 },
  jarBanner: {
    backgroundColor: '#fff7f3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffd4c4',
  },
  jarBannerTitle: { fontFamily: font.bold, color: '#c2410c', fontSize: 15 },
  jarBannerSub: { color: '#9a3412', fontSize: 13, marginTop: 4 },
  section: { fontSize: 15, fontFamily: font.semibold, marginBottom: 8, color: '#111' },
  recentTitle: { marginTop: 8 },
  muted: { color: '#666', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  currency: { fontFamily: font.semibold },
  actions: { marginVertical: 16, gap: 8 },
  btn: { backgroundColor: '#ff6f32', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: font.semibold },
  outline: {
    borderWidth: 1,
    borderColor: '#ff6f32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlineText: { color: '#ff6f32', fontFamily: font.semibold },
  txRow: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  txDate: { fontSize: 12, color: '#888', fontFamily: font.semibold, marginBottom: 4 },
  txTitle: { fontFamily: font.semibold, color: '#222' },
  txMeta: { color: '#666', fontSize: 13, marginTop: 4 },
});
