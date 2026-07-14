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
import * as categoriesRepo from '../db/repositories/categories';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { buildThemeChartPalette, pocketChartColor } from '../utils/pocketChartColors';

export default function CategoriesScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swatchPalette = useMemo(() => buildThemeChartPalette(colors, isDark), [colors, isDark]);
  const [items, setItems] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await categoriesRepo.listCategories();
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
      await categoriesRepo.createCategory({ name: newName, color: newColor });
      setNewName('');
      setNewColor(null);
      setCreateOpen(false);
      await reload();
    } catch (e) {
      Alert.alert('Could not create', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setEditName(row.name);
    setEditColor(row.color);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editId) return;
    setBusy(true);
    try {
      await categoriesRepo.updateCategory(editId, { name: editName, color: editColor });
      setEditOpen(false);
      setEditId(null);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tryDelete = (id, name) => {
    Alert.alert(
      'Delete category',
      `Remove "${name}"? Transactions using it will become uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await categoriesRepo.deleteCategory(id);
              await reload();
            } catch (e) {
              Alert.alert('Cannot delete', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  const renderSwatchRow = (selected, onSelect) => (
    <View style={styles.swatchRow}>
      <Pressable
        style={[styles.swatchNone, !selected && styles.swatchSelected]}
        onPress={() => onSelect(null)}
      >
        <Text style={styles.swatchNoneText}>None</Text>
      </Pressable>
      {swatchPalette.map((hex) => (
        <Pressable
          key={hex}
          style={[styles.swatch, { backgroundColor: hex }, selected === hex && styles.swatchSelected]}
          onPress={() => onSelect(hex)}
        />
      ))}
    </View>
  );

  return (
    <ScreenWithFooter>
    <View style={styles.container}>
      <Text style={styles.p}>
        Categories help you tag income and expense transactions (e.g. Groceries, Salary). Assign
        one when recording a transaction, then filter History or view Statistics by category.
      </Text>
      <Pressable style={styles.addBtn} onPress={() => setCreateOpen(true)}>
        <ContourOnPrimaryText style={styles.addBtnText}>+ New category</ContourOnPrimaryText>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No categories yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <View style={[styles.dot, { backgroundColor: item.color ?? pocketChartColor(item.id, swatchPalette) }]} />
              <Text style={styles.cardName}>{item.name}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => openEdit(item)} hitSlop={10}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => tryDelete(item.id, item.name)} hitSlop={10}>
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New category</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Groceries"
              placeholderTextColor={colors.placeholder}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Color (optional)</Text>
            {renderSwatchRow(newColor, setNewColor)}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitCreate()}
                style={styles.modalOk}
                disabled={busy || !newName.trim()}
              >
                <ContourOnPrimaryText style={styles.modalOkText}>Create</ContourOnPrimaryText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit category</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>Color (optional)</Text>
            {renderSwatchRow(editColor, setEditColor)}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setEditOpen(false);
                  setEditId(null);
                }}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitEdit()}
                style={styles.modalOk}
                disabled={busy || !editName.trim()}
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
    cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    dot: { width: 14, height: 14, borderRadius: 7 },
    cardName: { fontSize: 16, fontFamily: font.bold, color: c.text },
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
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.inputText,
    },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchNone: {
      paddingHorizontal: 10,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    swatchNoneText: { fontSize: 12, color: c.textMuted, fontFamily: font.semibold },
    swatchSelected: { borderColor: c.text },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 16 },
    modalCancel: { padding: 8 },
    modalCancelText: { color: c.textMuted, fontSize: 16 },
    modalOk: { backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    modalOkText: { fontFamily: font.semibold },
  });
}
