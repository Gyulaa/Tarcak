// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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

import { ContourOnPrimaryText } from '../components/ContourOnPrimaryText';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import * as assetTypesRepo from '../db/repositories/assetTypes';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export default function AssetTypesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameCode, setRenameCode] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await assetTypesRepo.listAssetTypes();
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const submitCreate = async () => {
    setBusy(true);
    try {
      await assetTypesRepo.createAssetType({ code: newCode, name: newName });
      setNewCode('');
      setNewName('');
      setCreateOpen(false);
      await reload();
    } catch (e) {
      Alert.alert('Could not create', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openRename = (row) => {
    setRenameId(row.id);
    setRenameCode(row.code);
    setRenameValue(row.name);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!renameId) return;
    setBusy(true);
    try {
      await assetTypesRepo.updateAssetTypeName(renameId, renameValue);
      setRenameOpen(false);
      setRenameId(null);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tryDelete = (id, code) => {
    Alert.alert('Delete asset type', `Remove "${code}"? Only allowed if no transactions use it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await assetTypesRepo.deleteAssetType(id);
            await reload();
          } catch (e) {
            Alert.alert('Cannot delete', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  return (
    <ScreenWithFooter>
    <View style={styles.container}>
      <Text style={styles.p}>
        Codes (e.g. HUF, USD, XMR) are stored on each transaction. Add types here, then pick them when
        recording a transaction or setting the default currency.
      </Text>
      <Pressable style={styles.addBtn} onPress={() => setCreateOpen(true)}>
        <ContourOnPrimaryText style={styles.addBtnText}>+ New asset type</ContourOnPrimaryText>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No asset types.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={styles.cardCode}>{item.code}</Text>
              <Text style={styles.cardName}>{item.name}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => openRename(item)} hitSlop={10}>
                <Text style={styles.link}>Rename</Text>
              </Pressable>
              <Pressable onPress={() => tryDelete(item.id, item.code)} hitSlop={10}>
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New asset type</Text>
            <Text style={styles.fieldLabel}>Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. XMR"
              placeholderTextColor={colors.placeholder}
              value={newCode}
              onChangeText={(t) => setNewCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Monero"
              placeholderTextColor={colors.placeholder}
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitCreate()}
                style={styles.modalOk}
                disabled={busy || !newCode.trim() || !newName.trim()}
              >
                <ContourOnPrimaryText style={styles.modalOkText}>Create</ContourOnPrimaryText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={renameOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename label</Text>
            <Text style={styles.fieldLabel}>Code (fixed)</Text>
            <Text style={styles.codeReadonly}>{renameCode}</Text>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setRenameOpen(false);
                  setRenameId(null);
                }}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitRename()}
                style={styles.modalOk}
                disabled={busy || !renameValue.trim()}
              >
                <ContourOnPrimaryText style={styles.modalOkText}>Save</ContourOnPrimaryText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </ScreenWithFooter>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    p: { color: c.textMuted, marginHorizontal: 16, marginTop: 12, marginBottom: 8, lineHeight: 22 },
    list: { padding: 16, paddingTop: 8 },
    muted: { textAlign: 'center', color: c.textMuted, marginTop: 24 },
    addBtn: {
      marginHorizontal: 16,
      marginBottom: 4,
      backgroundColor: c.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    addBtnText: { fontFamily: font.semibold },
    card: {
      backgroundColor: c.surface,
      padding: 14,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardMain: { marginBottom: 8 },
    cardCode: { fontSize: 16, fontFamily: font.bold, color: c.text },
    cardName: { fontSize: 14, color: c.textMuted, marginTop: 4 },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
    link: { color: c.primary, fontFamily: font.semibold, fontSize: 14 },
    delete: { color: c.danger, fontSize: 14 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'center',
      padding: 24,
    },
    modalBox: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: { fontSize: 18, fontFamily: font.semibold, marginBottom: 12, color: c.text },
    fieldLabel: { fontFamily: font.semibold, color: c.textSecondary, marginBottom: 4, marginTop: 8 },
    codeReadonly: { fontSize: 16, fontFamily: font.semibold, color: c.text, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.inputText,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 16 },
    modalCancel: { padding: 8 },
    modalCancelText: { color: c.textMuted, fontSize: 16 },
    modalOk: { backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    modalOkText: { fontFamily: font.semibold },
  });
}
