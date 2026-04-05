// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ModalSelectField } from '../components/ModalSelectField';
import * as pocketsRepo from '../db/repositories/pockets';
import * as txRepo from '../db/repositories/transactions';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';

const ALL = '__all__';

function txInvolvesPocket(tx, pocketId) {
  if (!pocketId) return true;
  if (tx.kind === 'transfer') {
    return tx.from_pocket_id === pocketId || tx.to_pocket_id === pocketId;
  }
  return tx.pocket_id === pocketId;
}

function applyHistoryFilters(items, { kind, currency, pocketId }) {
  return items.filter((tx) => {
    if (kind && tx.kind !== kind) return false;
    if (currency && tx.currency !== currency) return false;
    if (pocketId && !txInvolvesPocket(tx, pocketId)) return false;
    return true;
  });
}

export default function HistoryScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const paramPocketId = route.params?.pocketId;
  const [scopePocketId, setScopePocketId] = useState(paramPocketId);
  const [items, setItems] = useState([]);
  const [pocketNames, setPocketNames] = useState(() => new Map());
  const [filterLabel, setFilterLabel] = useState('');
  const [filterKind, setFilterKind] = useState(null);
  const [filterCurrency, setFilterCurrency] = useState(null);
  const [filterPocketId, setFilterPocketId] = useState(null);

  useEffect(() => {
    setScopePocketId(paramPocketId);
  }, [paramPocketId]);

  const load = useCallback(async () => {
    const list = await txRepo.listTransactions({
      pocketId: scopePocketId ?? null,
      limit: 300,
    });
    setItems(list);

    const active = await pocketsRepo.listPockets();
    const map = new Map(active.map((p) => [p.id, p.name]));
    const need = new Set();
    for (const tx of list) {
      if (tx.pocket_id) need.add(tx.pocket_id);
      if (tx.from_pocket_id) need.add(tx.from_pocket_id);
      if (tx.to_pocket_id) need.add(tx.to_pocket_id);
    }
    const missing = [...need].filter((id) => !map.has(id));
    await Promise.all(
      missing.map(async (id) => {
        const p = await pocketsRepo.getPocket(id);
        map.set(id, p?.name ?? 'Unknown');
      })
    );
    setPocketNames(map);

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

  const currencyOptions = useMemo(() => {
    const s = new Set(items.map((i) => i.currency));
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [items]);

  const pocketFilterOptions = useMemo(() => {
    const ids = new Set();
    for (const tx of items) {
      if (tx.pocket_id) ids.add(tx.pocket_id);
      if (tx.from_pocket_id) ids.add(tx.from_pocket_id);
      if (tx.to_pocket_id) ids.add(tx.to_pocket_id);
    }
    return [...ids]
      .map((id) => ({ id, name: pocketNames.get(id) ?? '…' }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [items, pocketNames]);

  const kindModalOptions = useMemo(
    () => [
      { value: ALL, title: 'All types' },
      { value: 'income', title: 'Income' },
      { value: 'expense', title: 'Expense' },
      { value: 'transfer', title: 'Transfer' },
    ],
    []
  );

  const currencyModalOptions = useMemo(
    () => [
      { value: ALL, title: 'All assets' },
      ...currencyOptions.map((c) => ({ value: c, title: c })),
    ],
    [currencyOptions]
  );

  const pocketModalOptions = useMemo(
    () => [
      { value: ALL, title: 'All pockets' },
      ...pocketFilterOptions.map((p) => ({ value: p.id, title: p.name })),
    ],
    [pocketFilterOptions]
  );

  const kindDisplay =
    filterKind === 'income'
      ? 'Income'
      : filterKind === 'expense'
        ? 'Expense'
        : filterKind === 'transfer'
          ? 'Transfer'
          : '';

  const currencyDisplay = filterCurrency ?? '';
  const pocketDisplay = filterPocketId ? pocketNames.get(filterPocketId) ?? 'Pocket' : '';

  const displayItems = useMemo(
    () =>
      applyHistoryFilters(items, {
        kind: filterKind,
        currency: filterCurrency,
        pocketId: filterPocketId,
      }),
    [items, filterKind, filterCurrency, filterPocketId]
  );

  const hasActiveFilters = filterKind != null || filterCurrency != null || filterPocketId != null;

  const clearFilters = () => {
    setFilterKind(null);
    setFilterCurrency(null);
    setFilterPocketId(null);
  };

  return (
    <View style={styles.container}>
      {scopePocketId ? (
        <Pressable style={styles.chip} onPress={() => setScopePocketId(undefined)}>
          <Text style={styles.chipText}>Showing one pocket · Tap to show all</Text>
        </Pressable>
      ) : null}

      <View style={styles.filterSection}>
        <View style={styles.filterHeaderRow}>
          <Text style={styles.filterSectionTitle}>Filters</Text>
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterFields}>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              label="Type"
              displayValue={kindDisplay}
              placeholder="All types"
              modalTitle="Transaction type"
              options={kindModalOptions}
              onSelect={(v) => setFilterKind(v === ALL ? null : v)}
            />
          </View>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              label="Asset"
              displayValue={currencyDisplay}
              placeholder="All assets"
              modalTitle="Asset"
              options={currencyModalOptions}
              onSelect={(v) => setFilterCurrency(v === ALL ? null : v)}
              emptyMessage="No assets in this list yet."
            />
          </View>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              label="Pocket"
              displayValue={pocketDisplay}
              placeholder="All pockets"
              modalTitle="Pocket"
              options={pocketModalOptions}
              onSelect={(v) => setFilterPocketId(v === ALL ? null : v)}
              variant="pocket"
              emptyMessage="No pockets in this list yet."
            />
          </View>
        </View>
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>
            {items.length === 0 ? 'No transactions yet.' : 'No transactions match these filters.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('TransactionEditor', { transactionId: item.id })}
          >
            <Text style={styles.dateLine}>{formatOccurredAt(item.occurred_at)}</Text>
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

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: { padding: 16 },
    muted: { textAlign: 'center', color: c.textMuted, marginTop: 24 },
    row: {
      padding: 14,
      backgroundColor: c.surface,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    dateLine: { fontSize: 12, color: c.textMuted, fontFamily: font.semibold, marginBottom: 6 },
    title: { fontFamily: font.semibold, fontSize: 16, color: c.textSecondary },
    meta: { color: c.textMuted, marginTop: 4, fontSize: 13 },
    chip: {
      marginHorizontal: 16,
      marginTop: 10,
      padding: 10,
      backgroundColor: c.chipBg,
      borderRadius: 8,
    },
    chipText: { color: c.chipText, textAlign: 'center', fontSize: 13 },
    filterSection: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    filterHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    filterSectionTitle: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.textMuted,
    },
    clearText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.primary,
    },
    filterFields: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 6,
      alignItems: 'flex-start',
    },
    filterCell: { flex: 1, minWidth: 0 },
  });
}
