// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ModalSelectField } from '../components/ModalSelectField';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import * as categoriesRepo from '../db/repositories/categories';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';
import { buildThemeChartPalette, pocketChartColor } from '../utils/pocketChartColors';

const ALL = '__all__';
const UNCATEGORIZED = '__uncategorized__';
const HISTORY_FETCH_LIMIT = 500;

const KIND_LABELS = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

function txInvolvesPocket(tx, pocketId) {
  if (!pocketId) return true;
  if (tx.kind === 'transfer') {
    return tx.from_pocket_id === pocketId || tx.to_pocket_id === pocketId;
  }
  return tx.pocket_id === pocketId;
}

/** Income filter also includes transfers into the Jar (money pooled from other pockets). */
function txMatchesKindFilter(tx, kinds, jarPocketId) {
  if (!kinds.length) return true;
  for (const kind of kinds) {
    if (kind === 'income') {
      if (tx.kind === 'income') return true;
      if (
        jarPocketId &&
        tx.kind === 'transfer' &&
        tx.to_pocket_id === jarPocketId &&
        tx.from_pocket_id !== jarPocketId
      ) {
        return true;
      }
    } else if (tx.kind === kind) {
      return true;
    }
  }
  return false;
}

function txMatchesCategoryFilter(tx, categoryIds) {
  if (!categoryIds.length) return true;
  return categoryIds.some((id) => (id === UNCATEGORIZED ? !tx.category_id : tx.category_id === id));
}

function applyHistoryFilters(items, { kinds, currencies, pocketIds, categoryIds, jarPocketId }) {
  return items.filter((tx) => {
    if (!txMatchesKindFilter(tx, kinds, jarPocketId)) return false;
    if (currencies.length && !currencies.includes(tx.currency)) return false;
    if (pocketIds.length && !pocketIds.some((id) => txInvolvesPocket(tx, id))) return false;
    if (!txMatchesCategoryFilter(tx, categoryIds)) return false;
    return true;
  });
}

function pocketLineForHistory(tx, names) {
  const n = (id) => (id ? names.get(id) ?? '…' : '…');
  if (tx.kind === 'transfer' && tx.from_pocket_id && tx.to_pocket_id) {
    return `${n(tx.from_pocket_id)} → ${n(tx.to_pocket_id)}`;
  }
  if (tx.pocket_id) return n(tx.pocket_id);
  return null;
}

function toggleInList(list, value, allToken = ALL) {
  if (value === allToken) return [];
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formatMultiDisplay(values, labelFor) {
  if (!values.length) return '';
  if (values.length === 1) return labelFor(values[0]);
  if (values.length === 2) return `${labelFor(values[0])}, ${labelFor(values[1])}`;
  return `${values.length} selected`;
}

export default function HistoryScreen({ navigation, route }) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chartPalette = useMemo(() => buildThemeChartPalette(colors, isDark), [colors, isDark]);
  const paramPocketId = route.params?.pocketId;
  const [scopePocketId, setScopePocketId] = useState(paramPocketId);
  const [items, setItems] = useState([]);
  const [pocketNames, setPocketNames] = useState(() => new Map());
  const [categories, setCategories] = useState([]);
  const [categoryNames, setCategoryNames] = useState(() => new Map());
  const [jarPocketId, setJarPocketId] = useState(null);
  const [filterLabel, setFilterLabel] = useState('');
  const [filterKinds, setFilterKinds] = useState([]);
  const [filterCurrencies, setFilterCurrencies] = useState([]);
  const [filterPocketIds, setFilterPocketIds] = useState([]);
  const [filterCategoryIds, setFilterCategoryIds] = useState([]);

  useEffect(() => {
    setScopePocketId(paramPocketId);
  }, [paramPocketId]);

  const load = useCallback(async () => {
    const list = await txRepo.listTransactions({
      pocketId: scopePocketId ?? null,
      limit: HISTORY_FETCH_LIMIT,
    });
    setItems(list);

    const jar = await pocketsRepo.getJarPocket();
    setJarPocketId(jar?.id ?? null);

    const cats = await categoriesRepo.listCategories();
    setCategories(cats);
    setCategoryNames(new Map(cats.map((c) => [c.id, { name: c.name, color: c.color }])));

    const showArchived = await settingsRepo.getShowArchivedPockets();
    const active = await pocketsRepo.listPockets(showArchived);
    const map = new Map(active.map((p) => [p.id, p.name]));
    if (jar) map.set(jar.id, jar.name);

    const need = new Set();
    for (const tx of list) {
      if (tx.pocket_id) need.add(tx.pocket_id);
      if (tx.from_pocket_id) need.add(tx.from_pocket_id);
      if (tx.to_pocket_id) need.add(tx.to_pocket_id);
    }
    if (jar) need.add(jar.id);

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
    if (jarPocketId) ids.add(jarPocketId);
    return [...ids]
      .map((id) => ({
        id,
        name: pocketNames.get(id) ?? '…',
        subtitle: id === jarPocketId ? 'Jar' : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [items, pocketNames, jarPocketId]);

  const kindModalOptions = useMemo(
    () => [
      { value: ALL, title: 'All types' },
      { value: 'income', title: 'Income', subtitle: 'Includes deposits and transfers into the Jar' },
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
      ...pocketFilterOptions.map((p) => ({
        value: p.id,
        title: p.name,
        subtitle: p.subtitle,
      })),
    ],
    [pocketFilterOptions]
  );

  const categoryModalOptions = useMemo(
    () => [
      { value: ALL, title: 'All categories' },
      { value: UNCATEGORIZED, title: 'Uncategorized' },
      ...categories.map((c) => ({ value: c.id, title: c.name })),
    ],
    [categories]
  );

  const kindDisplay = formatMultiDisplay(filterKinds, (k) => KIND_LABELS[k] ?? k);
  const currencyDisplay = formatMultiDisplay(filterCurrencies, (c) => c);
  const pocketDisplay = formatMultiDisplay(
    filterPocketIds,
    (id) => pocketNames.get(id) ?? 'Pocket'
  );
  const categoryDisplay = formatMultiDisplay(filterCategoryIds, (id) =>
    id === UNCATEGORIZED ? 'Uncategorized' : (categoryNames.get(id)?.name ?? 'Category')
  );

  const displayItems = useMemo(
    () =>
      applyHistoryFilters(items, {
        kinds: filterKinds,
        currencies: filterCurrencies,
        pocketIds: filterPocketIds,
        categoryIds: filterCategoryIds,
        jarPocketId,
      }),
    [items, filterKinds, filterCurrencies, filterPocketIds, filterCategoryIds, jarPocketId]
  );

  const hasActiveFilters =
    filterKinds.length > 0 ||
    filterCurrencies.length > 0 ||
    filterPocketIds.length > 0 ||
    filterCategoryIds.length > 0;

  const clearFilters = () => {
    setFilterKinds([]);
    setFilterCurrencies([]);
    setFilterPocketIds([]);
    setFilterCategoryIds([]);
  };

  const handleKindTap = (v) => {
    setFilterKinds(v === ALL ? [] : [v]);
  };
  const handleCurrencyTap = (v) => {
    setFilterCurrencies(v === ALL ? [] : [v]);
  };
  const handlePocketTap = (v) => {
    setFilterPocketIds(v === ALL ? [] : [v]);
  };
  const handleCategoryTap = (v) => {
    setFilterCategoryIds(v === ALL ? [] : [v]);
  };

  return (
    <ScreenWithFooter>
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
              accent
              multiSelect
              label="Type"
              displayValue={kindDisplay}
              placeholder="All types"
              modalTitle="Transaction type"
              options={kindModalOptions}
              selectedValues={filterKinds}
              onSelect={handleKindTap}
              onToggleValue={(v) => setFilterKinds((prev) => toggleInList(prev, v))}
            />
          </View>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              accent
              multiSelect
              label="Asset"
              displayValue={currencyDisplay}
              placeholder="All assets"
              modalTitle="Asset"
              options={currencyModalOptions}
              selectedValues={filterCurrencies}
              onSelect={handleCurrencyTap}
              onToggleValue={(v) => setFilterCurrencies((prev) => toggleInList(prev, v))}
              emptyMessage="No assets in this list yet."
            />
          </View>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              accent
              multiSelect
              label="Pocket"
              displayValue={pocketDisplay}
              placeholder="All pockets"
              modalTitle="Pocket"
              options={pocketModalOptions}
              selectedValues={filterPocketIds}
              onSelect={handlePocketTap}
              onToggleValue={(v) => setFilterPocketIds((prev) => toggleInList(prev, v))}
              variant="pocket"
              emptyMessage="No pockets in this list yet."
            />
          </View>
          <View style={styles.filterCell}>
            <ModalSelectField
              compact
              accent
              multiSelect
              label="Category"
              displayValue={categoryDisplay}
              placeholder="All categories"
              modalTitle="Category"
              options={categoryModalOptions}
              selectedValues={filterCategoryIds}
              onSelect={handleCategoryTap}
              onToggleValue={(v) => setFilterCategoryIds((prev) => toggleInList(prev, v))}
              emptyMessage="No categories yet."
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
        renderItem={({ item }) => {
          const pocketLine = pocketLineForHistory(item, pocketNames);
          const category = item.category_id ? categoryNames.get(item.category_id) : null;
          const categoryColor =
            category?.color ?? (item.category_id ? pocketChartColor(item.category_id, chartPalette) : null);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('TransactionEditor', { transactionId: item.id })}
            >
              <Text style={styles.dateLine}>{formatOccurredAt(item.occurred_at)}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {pocketLine ? <Text style={styles.pocketLine}>{pocketLine}</Text> : null}
              {category ? (
                <View style={styles.categoryLine}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                  <Text style={styles.categoryLineText}>{category.name}</Text>
                </View>
              ) : null}
              <Text style={styles.meta}>
                {item.kind} · {item.currency} · {formatMinorForDisplay(item.amount_minor, item.currency)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
    </ScreenWithFooter>
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
    pocketLine: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 4,
    },
    categoryLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    categoryDot: { width: 8, height: 8, borderRadius: 4 },
    categoryLineText: { fontSize: 13, color: c.textMuted },
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
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: c.chipBg,
      borderBottomWidth: 1,
      borderBottomColor: c.jarSoftBorder,
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
      color: c.primary,
    },
    clearText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.primary,
    },
    filterFields: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
      alignItems: 'flex-start',
    },
    filterCell: { flexBasis: '48%', flexGrow: 1, minWidth: 0 },
  });
}
