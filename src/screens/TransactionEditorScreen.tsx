// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModalSelectField } from '../components/ModalSelectField';
import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatMinorToAmountString, parseAmountStringToMinor } from '../utils/amountMinor';
import { formatOccurredAt } from '../utils/formatOccurredAt';

const KINDS = ['income', 'expense', 'transfer'];

export default function TransactionEditorScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createTxStyles(colors), [colors]);
  const { transactionId, presetKind, pocketId, fromPocketId, toPocketId } = route.params || {};

  const [loading, setLoading] = useState(!!transactionId);
  const [kind, setKind] = useState(presetKind || 'income');
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState('HUF');
  const [targetPocketId, setTargetPocketId] = useState(pocketId || '');
  const [fromId, setFromId] = useState(fromPocketId || '');
  const [toId, setToId] = useState(toPocketId || '');
  const [pockets, setPockets] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  /** Preserved when editing; ignored on create (we use time of save). */
  const [occurredAt, setOccurredAt] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const list = await pocketsRepo.listPockets();
        setPockets(list);
        const types = await assetTypesRepo.listAssetTypes();
        setAssetTypes(types);
      })();
    }, [])
  );

  useEffect(() => {
    if (presetKind) {
      setKind(presetKind);
    }
    if (pocketId) {
      setTargetPocketId(pocketId);
    }
    if (fromPocketId) {
      setFromId(fromPocketId);
    }
    if (toPocketId) {
      setToId(toPocketId);
    }
  }, [presetKind, pocketId, fromPocketId, toPocketId]);

  useEffect(() => {
    if (transactionId) {
      return;
    }
    void (async () => {
      const def = await settingsRepo.getDefaultCurrency();
      setCurrency(def);
    })();
  }, [transactionId]);

  useEffect(() => {
    if (!transactionId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const row = await txRepo.getTransaction(transactionId);
      if (!row) {
        Alert.alert('Missing', 'Transaction not found.');
        navigation.goBack();
        return;
      }
      setKind(row.kind);
      setTitle(row.title);
      setAmountStr(formatMinorToAmountString(row.amount_minor));
      setCurrency(row.currency);
      setTargetPocketId(row.pocket_id || '');
      setFromId(row.from_pocket_id || '');
      setToId(row.to_pocket_id || '');
      setOccurredAt(row.occurred_at);
      setLoading(false);
    })();
  }, [transactionId, navigation]);

  const pickerAssetTypes = useMemo(() => {
    const inCatalog = assetTypes.some((a) => a.code === currency);
    if (inCatalog || !currency) {
      return assetTypes;
    }
    return [
      {
        id: '__legacy__',
        code: currency,
        name: 'Not in catalog — add in Asset types or pick another',
        sort_index: -1,
        created_at: 0,
        updated_at: 0,
      },
      ...assetTypes,
    ];
  }, [assetTypes, currency]);

  const parseAmount = () => {
    const n = parseAmountStringToMinor(amountStr);
    if (kind === 'transfer' && n < 0) {
      throw new Error('Transfer amount must be positive.');
    }
    return n;
  };

  const save = async () => {
    try {
      if (!assetTypes.some((a) => a.code === currency)) {
        throw new Error(
          'Choose a registered asset type, or add this code under Settings → Asset types.'
        );
      }
      const amount_minor = parseAmount();
      const occurred_at = transactionId ? (occurredAt ?? Date.now()) : Date.now();
      if (transactionId) {
        await txRepo.updateTransaction(transactionId, {
          kind,
          title,
          amount_minor,
          currency,
          occurred_at,
          pocket_id: kind === 'transfer' ? null : targetPocketId || null,
          from_pocket_id: kind === 'transfer' ? fromId : null,
          to_pocket_id: kind === 'transfer' ? toId : null,
        });
      } else if (kind === 'income') {
        if (!targetPocketId) {
          throw new Error('Choose a pocket.');
        }
        await txRepo.insertIncome({
          title,
          amount_minor,
          currency,
          occurred_at: occurred_at,
          pocket_id: targetPocketId,
        });
      } else if (kind === 'expense') {
        if (!targetPocketId) {
          throw new Error('Choose a pocket.');
        }
        await txRepo.insertExpense({
          title,
          amount_minor,
          currency,
          occurred_at: occurred_at,
          pocket_id: targetPocketId,
        });
      } else {
        if (!fromId || !toId) {
          throw new Error('Choose from and to pockets.');
        }
        await txRepo.insertTransfer({
          title,
          amount_minor,
          currency,
          occurred_at: occurred_at,
          from_pocket_id: fromId,
          to_pocket_id: toId,
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Cannot save', e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    if (!transactionId) return;
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await txRepo.deleteTransaction(transactionId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const assetSelectOptions = useMemo(
    () =>
      pickerAssetTypes.map((a) => ({
        value: a.code,
        title: a.code,
        subtitle: a.name,
      })),
    [pickerAssetTypes]
  );

  const pocketSelectOptions = useMemo(
    () => pockets.map((p) => ({ value: p.id, title: p.name })),
    [pockets]
  );

  const selectedAssetLabel = useMemo(() => {
    const a = pickerAssetTypes.find((x) => x.code === currency);
    return a ? `${a.code} — ${a.name}` : '';
  }, [pickerAssetTypes, currency]);

  const targetPocketLabel = useMemo(() => {
    const p = pockets.find((x) => x.id === targetPocketId);
    return p?.name ?? '';
  }, [pockets, targetPocketId]);

  const fromPocketLabel = useMemo(() => {
    const p = pockets.find((x) => x.id === fromId);
    return p?.name ?? '';
  }, [pockets, fromId]);

  const toPocketLabel = useMemo(() => {
    const p = pockets.find((x) => x.id === toId);
    return p?.name ?? '';
  }, [pockets, toId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {!transactionId ? (
        <Text style={styles.label}>Kind</Text>
      ) : (
        <Text style={styles.label}>Kind (editable)</Text>
      )}
      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            style={[styles.kindChip, kind === k && styles.kindChipOn]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.kindChipText, kind === k && styles.kindChipTextOn]}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Groceries"
        placeholderTextColor={colors.placeholder}
      />

      {transactionId && occurredAt != null ? (
        <>
          <Text style={styles.label}>Conducted</Text>
          <Text style={styles.conductedText}>{formatOccurredAt(occurredAt)}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        value={amountStr}
        onChangeText={setAmountStr}
        keyboardType="numbers-and-punctuation"
        placeholder="0.00"
        placeholderTextColor={colors.placeholder}
      />

      {pickerAssetTypes.length === 0 ? (
        <>
          <Text style={styles.label}>Asset type</Text>
          <Text style={styles.muted}>No asset types yet. Add some under Settings → Asset types.</Text>
        </>
      ) : (
        <ModalSelectField
          label="Asset type"
          displayValue={selectedAssetLabel}
          placeholder="Select asset type"
          modalTitle="Asset type"
          options={assetSelectOptions}
          onSelect={setCurrency}
          emptyMessage="No asset types yet. Add some under Settings → Asset types."
        />
      )}
      <Pressable onPress={() => navigation.navigate('AssetTypes')} style={styles.manageLink}>
        <Text style={styles.manageLinkText}>Manage asset types…</Text>
      </Pressable>

      {kind !== 'transfer' ? (
        <ModalSelectField
          label="Pocket"
          displayValue={targetPocketLabel}
          placeholder="Select pocket"
          modalTitle="Pocket"
          options={pocketSelectOptions}
          onSelect={setTargetPocketId}
          variant="pocket"
          emptyMessage="No pockets yet. Create one under Pockets."
        />
      ) : (
        <>
          <ModalSelectField
            label="From pocket"
            displayValue={fromPocketLabel}
            placeholder="Select pocket"
            modalTitle="From pocket"
            options={pocketSelectOptions}
            onSelect={setFromId}
            variant="pocket"
            emptyMessage="No pockets yet. Create one under Pockets."
          />
          <ModalSelectField
            label="To pocket"
            displayValue={toPocketLabel}
            placeholder="Select pocket"
            modalTitle="To pocket"
            options={pocketSelectOptions}
            onSelect={setToId}
            variant="pocket"
            emptyMessage="No pockets yet. Create one under Pockets."
          />
        </>
      )}

      <Pressable style={styles.saveBtn} onPress={() => void save()}>
        <Text style={styles.saveBtnText}>{transactionId ? 'Save changes' : 'Save'}</Text>
      </Pressable>

      {transactionId ? (
        <Pressable style={styles.delBtn} onPress={remove}>
          <Text style={styles.delBtnText}>Delete</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function createTxStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
    loadingText: { color: c.textMuted, fontSize: 16 },
    label: { fontFamily: font.semibold, marginTop: 12, marginBottom: 6, color: c.text },
    conductedText: { fontSize: 16, color: c.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 12,
      backgroundColor: c.inputBg,
      fontSize: 16,
      color: c.inputText,
    },
    kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kindChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.pillBg,
    },
    kindChipOn: { backgroundColor: c.primary },
    kindChipText: { color: c.pillText },
    kindChipTextOn: { color: c.onPrimary, fontFamily: font.semibold },
    muted: { color: c.textMuted, paddingVertical: 8 },
    manageLink: { marginTop: 8, paddingVertical: 6 },
    manageLinkText: { color: c.primary, fontFamily: font.semibold },
    saveBtn: {
      marginTop: 24,
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    saveBtnText: { color: c.onPrimary, fontFamily: font.bold, fontSize: 16 },
    delBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
    delBtnText: { color: c.danger, fontFamily: font.semibold },
  });
}
