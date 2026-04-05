// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import * as pocketsRepo from '../db/repositories/pockets';
import * as txRepo from '../db/repositories/transactions';
import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';

export default function HistoryScreen({ navigation, route }) {
  const paramPocketId = route.params?.pocketId;
  const [scopePocketId, setScopePocketId] = useState(paramPocketId);
  const [items, setItems] = useState([]);
  const [filterLabel, setFilterLabel] = useState('');

  useEffect(() => {
    setScopePocketId(paramPocketId);
  }, [paramPocketId]);

  const load = useCallback(async () => {
    const list = await txRepo.listTransactions({
      pocketId: scopePocketId ?? null,
      limit: 300,
    });
    setItems(list);
    if (scopePocketId) {
      const p = await pocketsRepo.getPocket(scopePocketId);
      setFilterLabel(p?.name ?? 'Pocket');
    } else {
      setFilterLabel('');
    }
  }, [scopePocketId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: scopePocketId ? `History · ${filterLabel || '…'}` : 'History',
    });
  }, [navigation, scopePocketId, filterLabel]);

  return (
    <View style={styles.container}>
      {scopePocketId ? (
        <Pressable style={styles.chip} onPress={() => setScopePocketId(undefined)}>
          <Text style={styles.chipText}>Showing one pocket · Tap to show all</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No transactions yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('TransactionEditor', { transactionId: item.id })}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.kind} · {item.currency} · {formatMinorForDisplay(item.amount_minor, item.currency)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { padding: 16 },
  muted: { textAlign: 'center', color: '#666', marginTop: 24 },
  row: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  title: { fontFamily: font.semibold, fontSize: 16, color: '#222' },
  meta: { color: '#666', marginTop: 4, fontSize: 13 },
  chip: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff0eb',
    borderRadius: 8,
  },
  chipText: { color: '#ff6f32', textAlign: 'center', fontSize: 13 },
});
