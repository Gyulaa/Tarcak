// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLedgerStore } from '../stores/ledgerStore';
import { font } from '../theme/fonts';

export default function PocketsScreen({ navigation }) {
  const pockets = useLedgerStore((s) => s.pockets);
  const refresh = useLedgerStore((s) => s.refresh);
  const addPocket = useLedgerStore((s) => s.addPocket);
  const removePocketIfEmpty = useLedgerStore((s) => s.removePocketIfEmpty);
  const lastError = useLedgerStore((s) => s.lastError);

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const submitNew = async () => {
    setBusy(true);
    try {
      await addPocket(newName);
      setNewName('');
      setModalOpen(false);
    } catch (e) {
      Alert.alert('Could not create pocket', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tryDelete = (id: string, name: string) => {
    Alert.alert('Delete pocket', `Remove "${name}"? Only allowed if it has no transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await removePocketIfEmpty(id);
          if (!ok) {
            Alert.alert('Still in use', 'Remove or reassign transactions first.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
        <Text style={styles.addBtnText}>+ New pocket</Text>
      </Pressable>
      <FlatList
        data={pockets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No pockets yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('PocketDetail', { pocketId: item.id })}
          >
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Pressable onPress={() => tryDelete(item.id, item.name)} hitSlop={10}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New pocket</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.modalCancel}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitNew()}
                style={styles.modalOk}
                disabled={busy || !newName.trim()}
              >
                <Text style={styles.modalOkText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { padding: 16, paddingTop: 8 },
  muted: { textAlign: 'center', color: '#666', marginTop: 24 },
  error: { color: '#b00020', paddingHorizontal: 16, paddingTop: 8 },
  addBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#ff6f32',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontFamily: font.semibold },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: font.semibold, color: '#222' },
  delete: { color: '#b00020', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontFamily: font.semibold, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 16 },
  modalCancel: { padding: 8 },
  modalOk: { backgroundColor: '#ff6f32', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  modalOkText: { color: '#fff', fontFamily: font.semibold },
});
