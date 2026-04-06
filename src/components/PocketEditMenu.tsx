// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContourOnPrimaryText } from './ContourOnPrimaryText';

import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { useLedgerStore } from '../stores/ledgerStore';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export type PocketEditTarget = {
  id: string;
  name: string;
  is_jar: boolean;
  archived: boolean;
};

type Props = {
  visible: boolean;
  pocket: PocketEditTarget | null;
  onClose: () => void;
  /** After rename / archive / unarchive / delete — refresh lists */
  onMutated: () => void | Promise<void>;
  /** Optional: e.g. go back from pocket detail when archived and setting is off */
  afterArchive?: () => void | Promise<void>;
};

export function PocketEditMenu({ visible, pocket, onClose, onMutated, afterArchive }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const renamePocketStore = useLedgerStore((s) => s.renamePocket);
  const removePocketIfEmpty = useLedgerStore((s) => s.removePocketIfEmpty);

  const [step, setStep] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [txnCount, setTxnCount] = useState(0);
  const [hasNonZero, setHasNonZero] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  const loadEligibility = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [n, nz] = await Promise.all([
        pocketsRepo.countTransactionsForPocket(id),
        txRepo.pocketHasNonZeroBalance(id),
      ]);
      setTxnCount(n);
      setHasNonZero(nz);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && pocket) {
      setStep('menu');
      setRenameDraft(pocket.name);
      void loadEligibility(pocket.id);
    }
  }, [visible, pocket?.id, pocket?.name, loadEligibility]);

  const canArchive = pocket && !pocket.is_jar && !pocket.archived && !hasNonZero;
  const canDelete = pocket && !pocket.is_jar && txnCount === 0;
  const showUnarchive = pocket && !pocket.is_jar && pocket.archived;
  const isJarOnly = pocket?.is_jar === true;

  const closeAll = () => {
    setStep('menu');
    onClose();
  };

  const runRename = async () => {
    if (!pocket) return;
    setRenameBusy(true);
    try {
      await renamePocketStore(pocket.id, renameDraft);
      setStep('menu');
      await onMutated();
      closeAll();
    } catch (e) {
      Alert.alert('Could not rename', e instanceof Error ? e.message : String(e));
    } finally {
      setRenameBusy(false);
    }
  };

  const runArchive = () => {
    if (!pocket || !canArchive) return;
    Alert.alert(
      'Archive pocket',
      'Hide this pocket from lists while keeping its transaction history. Turn on “Show archived pockets” in Settings if you want to find it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await pocketsRepo.setRegularPocketArchived(pocket.id, true);
              await onMutated();
              await afterArchive?.();
              closeAll();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  const runUnarchive = async () => {
    if (!pocket) return;
    try {
      await pocketsRepo.setRegularPocketArchived(pocket.id, false);
      await onMutated();
      closeAll();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const runDelete = () => {
    if (!pocket || !canDelete) return;
    Alert.alert('Delete pocket', `Remove “${pocket.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await removePocketIfEmpty(pocket.id);
          if (!ok) {
            Alert.alert('Cannot delete', 'This pocket still has transactions.');
            return;
          }
          await onMutated();
          closeAll();
        },
      },
    ]);
  };

  if (!pocket) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAll}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeAll} accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          {step === 'menu' ? (
            <>
              <Text style={styles.sheetTitle}>{isJarOnly ? 'Jar' : 'Pocket'}</Text>
              <Text style={styles.sheetName} numberOfLines={2}>
                {pocket.name}
              </Text>

              {loading ? (
                <ActivityIndicator style={styles.loader} color={colors.primary} />
              ) : (
                <>
                  <Pressable
                    style={styles.menuRow}
                    onPress={() => {
                      setRenameDraft(pocket.name);
                      setStep('rename');
                    }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                    <Text style={styles.menuRowText}>Rename</Text>
                  </Pressable>

                  {!isJarOnly ? (
                    <>
                      {showUnarchive ? (
                        <Pressable style={styles.menuRow} onPress={() => void runUnarchive()}>
                          <Ionicons name="archive-outline" size={22} color={colors.primary} />
                          <Text style={styles.menuRowText}>Unarchive</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.menuRow, !canArchive && styles.menuRowDisabled]}
                          onPress={() => {
                            if (canArchive) runArchive();
                            else
                              Alert.alert(
                                'Cannot archive',
                                'All assets in this pocket must net to zero before you can archive it.'
                              );
                          }}
                        >
                          <Ionicons
                            name="archive-outline"
                            size={22}
                            color={canArchive ? colors.primary : colors.textMuted}
                          />
                          <View style={styles.menuRowCol}>
                            <Text
                              style={[
                                styles.menuRowText,
                                !canArchive && styles.menuRowTextDisabled,
                              ]}
                            >
                              Archive
                            </Text>
                            {!canArchive && !pocket.archived ? (
                              <Text style={styles.menuHint}>Requires zero balance</Text>
                            ) : null}
                          </View>
                        </Pressable>
                      )}

                      <Pressable
                        style={[styles.menuRow, !canDelete && styles.menuRowDisabled]}
                        onPress={() => {
                          if (canDelete) runDelete();
                          else
                            Alert.alert(
                              'Cannot delete',
                              'Only pockets with no transactions can be deleted. Archive instead if the balance is zero.'
                            );
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={22}
                          color={canDelete ? colors.danger : colors.textMuted}
                        />
                        <View style={styles.menuRowCol}>
                          <Text
                            style={[
                              styles.menuRowText,
                              !canDelete && styles.menuRowTextDisabled,
                              canDelete && { color: colors.danger },
                            ]}
                          >
                            Delete
                          </Text>
                          {!canDelete ? (
                            <Text style={styles.menuHint}>No transactions required</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    </>
                  ) : null}
                </>
              )}

              <Pressable style={styles.cancelRow} onPress={closeAll}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.backRow} onPress={() => setStep('menu')}>
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Rename</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={colors.placeholder}
                value={renameDraft}
                onChangeText={setRenameDraft}
                autoFocus
                selectionColor={colors.primary}
              />
              <View style={styles.renameActions}>
                <Pressable onPress={() => setStep('menu')} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void runRename()}
                  style={styles.modalOk}
                  disabled={renameBusy || !renameDraft.trim()}
                >
                  <ContourOnPrimaryText style={styles.modalOkText}>Save</ContourOnPrimaryText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Pencil button for list rows (place beside a row `Pressable`, not inside it). */
export function PocketEditPencilButton({ onPress, colors }: { onPress: () => void; colors: AppColors }) {
  return (
    <Pressable
      onPress={onPress}
      style={pencilStyles.wrap}
      hitSlop={12}
      accessibilityLabel="Edit pocket"
    >
      <Ionicons name="pencil" size={22} color={colors.primary} />
    </Pressable>
  );
}

const pencilStyles = StyleSheet.create({
  wrap: { padding: 8, justifyContent: 'center', alignItems: 'center' },
});

function createStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'flex-end',
      padding: 16,
      paddingBottom: 28,
    },
    sheet: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    sheetTitle: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sheetName: {
      fontSize: 20,
      fontFamily: font.bold,
      color: c.text,
      marginTop: 4,
      marginBottom: 12,
    },
    loader: { marginVertical: 20 },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    menuRowDisabled: { opacity: 0.85 },
    menuRowCol: { flex: 1 },
    menuRowText: { fontSize: 17, color: c.text, fontFamily: font.semibold },
    menuRowTextDisabled: { color: c.textMuted },
    menuHint: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    cancelRow: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: { fontSize: 16, color: c.textMuted, fontFamily: font.semibold },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    backText: { fontSize: 16, color: c.primary, fontFamily: font.semibold },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.inputText,
      marginTop: 8,
    },
    renameActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 16,
      gap: 16,
    },
    modalCancel: { padding: 8 },
    modalCancelText: { color: c.textMuted, fontSize: 16 },
    modalOk: {
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modalOkText: { fontFamily: font.semibold },
  });
}
