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

import * as settingsRepo from '../db/repositories/settings';
import { useLedgerStore } from '../stores/ledgerStore';
import { font } from '../theme/fonts';

export default function PocketsScreen({ navigation }) {
  const allPockets = useLedgerStore((s) => s.pockets);
  const jarPocket = allPockets.find((p) => p.is_jar);
  const regularPockets = allPockets.filter((p) => !p.is_jar);
  const listData = jarPocket ? [jarPocket, ...regularPockets] : regularPockets;
  const refresh = useLedgerStore((s) => s.refresh);
  const addPocket = useLedgerStore((s) => s.addPocket);
  const removePocketIfEmpty = useLedgerStore((s) => s.removePocketIfEmpty);
  const lastError = useLedgerStore((s) => s.lastError);

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [jarEnabled, setJarEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void (async () => {
        setJarEnabled(await settingsRepo.getJarEnabled());
      })();
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
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No pockets yet.</Text>}
        renderItem={({ item }) => {
          const isJarRow = item.is_jar;
          const jarUx = isJarRow && jarEnabled;
          if (jarUx) {
            return (
              <Pressable
                style={styles.jarCard}
                onPress={() => navigation.navigate('Jar')}
              >
                <View style={styles.jarCardIcon}>
                  <Text style={styles.jarIconGlyph}>J</Text>
                </View>
                <View style={styles.jarCardMain}>
                  <Text style={styles.jarBadge}>Jar</Text>
                  <Text style={styles.jarCardTitle}>{item.name}</Text>
                  <Text style={styles.jarCardHint}>Pool · tap to distribute</Text>
                </View>
                <Text style={styles.jarChevron}>›</Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('PocketDetail', { pocketId: item.id })}
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.name}</Text>
              </View>
              {!isJarRow ? (
                <Pressable onPress={() => tryDelete(item.id, item.name)} hitSlop={10}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              ) : (
                <View style={styles.jarNoDelete} />
              )}
            </Pressable>
          );
        }}
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
  jarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7f3',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffd4c4',
    shadowColor: '#ff6f32',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  jarCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ff6f32',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  jarIconGlyph: { color: '#fff', fontSize: 20, fontFamily: font.bold },
  jarCardMain: { flex: 1 },
  jarBadge: {
    fontSize: 11,
    fontFamily: font.bold,
    color: '#ff6f32',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jarCardTitle: { fontSize: 17, fontFamily: font.bold, color: '#1a1a1a' },
  jarCardHint: { fontSize: 13, color: '#9a3412', marginTop: 4 },
  jarChevron: { fontSize: 26, color: '#ff6f32', fontWeight: '300' },
  jarNoDelete: { width: 48 },
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
