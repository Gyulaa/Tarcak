// @ts-nocheck
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export type ModalSelectOption = {
  value: string;
  title: string;
  subtitle?: string;
};

type Props = {
  label: string;
  /** Shown in the closed field; empty string uses placeholder */
  displayValue: string;
  placeholder: string;
  modalTitle: string;
  options: ModalSelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  /** Pocket lists use the same tile colors as the old inline picker */
  variant?: 'default' | 'pocket';
  emptyMessage?: string;
  /** Tighter label + field for toolbar / multi-column rows (e.g. History filters). */
  compact?: boolean;
  /** Soft warm tint on compact labels, chevron, field border, and sheet top edge (e.g. History filters). */
  accent?: boolean;
};

export function ModalSelectField({
  label,
  displayValue,
  placeholder,
  modalTitle,
  options,
  onSelect,
  disabled,
  variant = 'default',
  emptyMessage = 'Nothing to choose yet.',
  compact = false,
  accent = false,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, variant, compact, accent),
    [colors, variant, compact, accent]
  );
  const [open, setOpen] = useState(false);
  const trimmed = displayValue.trim();
  const showPlaceholder = !trimmed;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <Text
          style={[styles.fieldText, showPlaceholder && styles.fieldPlaceholder]}
          numberOfLines={compact ? 1 : 2}
          ellipsizeMode="tail"
        >
          {showPlaceholder ? placeholder : trimmed}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{modalTitle}</Text>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={styles.empty}>{emptyMessage}</Text>
              ) : (
                options.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.row}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{opt.title}</Text>
                      {opt.subtitle ? <Text style={styles.rowSub}>{opt.subtitle}</Text> : null}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(
  c: AppColors,
  variant: 'default' | 'pocket',
  compact: boolean,
  accent: boolean
) {
  /** Compact filter rows use one grey for all three fields; full-size pocket pickers keep tile styling. */
  const fieldBg = variant === 'pocket' && !compact ? c.pocketPickBg : c.inputBg;
  const fieldBorderDefault =
    variant === 'pocket' && !compact ? c.pocketPickBorder : c.inputBorder;
  const fieldBorder = accent && compact ? c.jarSoftBorder : fieldBorderDefault;
  const rowBg = variant === 'pocket' ? c.pocketPickBg : c.surface;
  const rowBorder = variant === 'pocket' ? c.pocketPickBorder : c.border;

  return StyleSheet.create({
    label: {
      fontFamily: font.semibold,
      marginTop: compact ? 2 : 12,
      marginBottom: compact ? 4 : 6,
      fontSize: compact ? 11 : undefined,
      color: compact ? (accent ? c.primary : c.textMuted) : c.text,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: fieldBorder,
      borderRadius: compact ? 8 : 10,
      paddingHorizontal: compact ? 8 : 14,
      paddingVertical: compact ? 10 : 14,
      backgroundColor: fieldBg,
      gap: compact ? 4 : 10,
    },
    fieldDisabled: { opacity: 0.5 },
    fieldText: { flex: 1, fontSize: compact ? 13 : 16, color: c.inputText },
    fieldPlaceholder: { color: c.placeholder },
    chevron: {
      fontSize: compact ? 18 : 22,
      color: accent && compact ? c.primary : c.textMuted,
      fontWeight: '300',
    },
    overlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 28,
      maxHeight: '72%',
      borderTopWidth: accent ? 2 : 1,
      borderColor: accent ? c.jarSoftBorder : c.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      marginBottom: 12,
      color: c.text,
    },
    scroll: { maxHeight: 360 },
    empty: { color: c.textMuted, paddingVertical: 16, fontSize: 15 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 6,
      backgroundColor: rowBg,
      borderWidth: 1,
      borderColor: rowBorder,
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 16, fontFamily: font.semibold, color: c.text },
    rowSub: { fontSize: 13, color: c.textMuted, marginTop: 3 },
    closeBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
    closeBtnText: { color: c.textMuted, fontFamily: font.semibold, fontSize: 16 },
  });
}
