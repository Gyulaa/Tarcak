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
import { PocketEditMenu, PocketEditPencilButton } from '../components/PocketEditMenu';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import * as settingsRepo from '../db/repositories/settings';
import { useLedgerStore } from '../stores/ledgerStore';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export default function PocketsScreen({ navigation }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const allPockets = useLedgerStore((s) => s.pockets);
  const jarPocket = allPockets.find((p) => p.is_jar);
  const regularPockets = allPockets.filter((p) => !p.is_jar);
  const listData = jarPocket ? [jarPocket, ...regularPockets] : regularPockets;
  const refresh = useLedgerStore((s) => s.refresh);
  const addPocket = useLedgerStore((s) => s.addPocket);
  const lastError = useLedgerStore((s) => s.lastError);

  const [editTarget, setEditTarget] = useState(null);
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

  const openEdit = (item) => {
    setEditTarget({
      id: item.id,
      name: item.name,
      is_jar: item.is_jar,
      archived: item.archived,
    });
  };

  return (
    <ScreenWithFooter>
    <View style={styles.container}>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
        <ContourOnPrimaryText style={styles.addBtnText}>+ New pocket</ContourOnPrimaryText>
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
              <View style={styles.jarCard}>
                <Pressable
                  style={styles.jarCardPress}
                  onPress={() => navigation.navigate('Jar')}
                >
                  <View style={styles.jarCardIcon}>
                    <ContourOnPrimaryText style={styles.jarIconGlyph}>J</ContourOnPrimaryText>
                  </View>
                  <View style={styles.jarCardMain}>
                    <Text style={styles.jarBadge}>Jar</Text>
                    <Text style={styles.jarCardTitle}>{item.name}</Text>
                    <Text style={styles.jarCardHint}>Pool · tap to distribute</Text>
                  </View>
                </Pressable>
                <PocketEditPencilButton colors={colors} onPress={() => openEdit(item)} />
              </View>
            );
          }
          const isArchivedRegular = !isJarRow && item.archived;
          return (
            <View style={[styles.card, isArchivedRegular && styles.cardArchived]}>
              <Pressable
                style={styles.cardPress}
                onPress={() => navigation.navigate('PocketDetail', { pocketId: item.id })}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {isArchivedRegular ? (
                    <Text style={styles.archivedHint}>Archived · use edit to unarchive</Text>
                  ) : null}
                </View>
              </Pressable>
              <PocketEditPencilButton colors={colors} onPress={() => openEdit(item)} />
            </View>
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
              placeholderTextColor={colors.placeholder}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              selectionColor={colors.primary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitNew()}
                style={styles.modalOk}
                disabled={busy || !newName.trim()}
              >
                <ContourOnPrimaryText style={styles.modalOkText}>Create</ContourOnPrimaryText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PocketEditMenu
        visible={!!editTarget}
        pocket={editTarget}
        onClose={() => setEditTarget(null)}
        onMutated={() => void refresh()}
      />
    </View>
    </ScreenWithFooter>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: { padding: 16, paddingTop: 8 },
    muted: { textAlign: 'center', color: c.textMuted, marginTop: 24 },
    error: { color: c.danger, paddingHorizontal: 16, paddingTop: 8 },
    addBtn: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: c.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    addBtnText: { fontFamily: font.semibold },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardPress: { flex: 1, padding: 14, minWidth: 0 },
    cardMain: { flex: 1 },
    cardTitle: { fontSize: 16, fontFamily: font.semibold, color: c.text },
    cardArchived: { opacity: 0.85, borderStyle: 'dashed' },
    archivedHint: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    jarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.jarSoftBg,
      borderRadius: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
      shadowColor: c.shadowJar,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    jarCardPress: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      paddingRight: 4,
      minWidth: 0,
    },
    jarCardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    jarIconGlyph: { fontSize: 20, fontFamily: font.bold },
    jarCardMain: { flex: 1 },
    jarBadge: {
      fontSize: 11,
      fontFamily: font.bold,
      color: c.primary,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    jarCardTitle: { fontSize: 17, fontFamily: font.bold, color: c.jarTitle },
    jarCardHint: { fontSize: 13, color: c.jarHint, marginTop: 4 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'center',
      padding: 24,
    },
    modalBox: { backgroundColor: c.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 18, fontFamily: font.semibold, marginBottom: 12, color: c.text },
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
