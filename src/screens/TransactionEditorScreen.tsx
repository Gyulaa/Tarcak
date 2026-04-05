// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { font } from '../theme/fonts';
import { formatMinorToAmountString, parseAmountStringToMinor } from '../utils/amountMinor';

const KINDS = ['income', 'expense', 'transfer'];

export default function TransactionEditorScreen({ navigation, route }) {
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
  /** Preserved when editing; ignored on create (we use time of save). */
  const [occurredAt, setOccurredAt] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await pocketsRepo.listPockets();
      setPockets(list);
      const def = await settingsRepo.getDefaultCurrency();
      if (!transactionId) {
        setCurrency(def);
      }
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
      if (transactionId) {
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
      }
      setLoading(false);
    })();
  }, [transactionId, presetKind, pocketId, fromPocketId, toPocketId, navigation]);

  const parseAmount = () => {
    const n = parseAmountStringToMinor(amountStr);
    if (kind === 'transfer' && n < 0) {
      throw new Error('Transfer amount must be positive.');
    }
    return n;
  };

  const save = async () => {
    try {
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const pocketOptions = pockets;

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
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Groceries" />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        value={amountStr}
        onChangeText={setAmountStr}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Currency code</Text>
      <TextInput
        style={styles.input}
        value={currency}
        onChangeText={(t) => setCurrency(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
      />

      {kind !== 'transfer' ? (
        <>
          <Text style={styles.label}>Pocket</Text>
          <View style={styles.pickList}>
            {pocketOptions.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.pick, targetPocketId === p.id && styles.pickOn]}
                onPress={() => setTargetPocketId(p.id)}
              >
                <Text style={targetPocketId === p.id ? styles.pickOnText : undefined}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>From pocket</Text>
          <View style={styles.pickList}>
            {pocketOptions.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.pick, fromId === p.id && styles.pickOn]}
                onPress={() => setFromId(p.id)}
              >
                <Text style={fromId === p.id ? styles.pickOnText : undefined}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>To pocket</Text>
          <View style={styles.pickList}>
            {pocketOptions.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.pick, toId === p.id && styles.pickOn]}
                onPress={() => setToId(p.id)}
              >
                <Text style={toId === p.id ? styles.pickOnText : undefined}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  inner: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: font.semibold, marginTop: 12, marginBottom: 6, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
  },
  kindChipOn: { backgroundColor: '#ff6f32' },
  kindChipText: { color: '#333' },
  kindChipTextOn: { color: '#fff', fontFamily: font.semibold },
  pickList: { gap: 6 },
  pick: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickOn: { borderColor: '#ff6f32', backgroundColor: '#fff0eb' },
  pickOnText: { fontFamily: font.semibold, color: '#ff6f32' },
  saveBtn: {
    marginTop: 24,
    backgroundColor: '#ff6f32',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 16 },
  delBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
  delBtnText: { color: '#b00020', fontFamily: font.semibold },
});
