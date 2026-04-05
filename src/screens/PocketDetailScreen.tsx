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
import * as txRepo from '../db/repositories/transactions';
import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';

export default function PocketDetailScreen({ navigation, route }) {
  const { pocketId } = route.params;
  const [pocketName, setPocketName] = useState('');
  const [balances, setBalances] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await pocketsRepo.getPocket(pocketId);
      setPocketName(p?.name ?? 'Pocket');
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
  txTitle: { fontFamily: font.semibold, color: '#222' },
  txMeta: { color: '#666', fontSize: 13, marginTop: 4 },
});
