// @ts-nocheck
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/fonts';
import type { AppColors } from '../../theme/palette';
import {
  equalSplitPercents,
  normalizeSplitRowsTo100,
  splitsSumValid,
  type SplitRow,
} from '../../domain/jarAdvancedEditorTypes';

type Props = {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  readOnly?: boolean;
  onAddPocket?: () => void;
  onSplitEvenly?: () => void;
  addPocketDisabled?: boolean;
};

export function JarAdvancedSplitEditor({
  rows,
  onChange,
  readOnly = false,
  onAddPocket,
  onSplitEvenly,
  addPocketDisabled,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sumOk = splitsSumValid(rows);

  const updatePercent = (pocketId: string, text: string) => {
    const t = text.trim().replace(',', '.');
    if (t === '') {
      onChange(rows.map((r) => (r.pocketId === pocketId ? { ...r, percent: 0 } : r)));
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) return;
    const next = rows.map((r) =>
      r.pocketId === pocketId ? { ...r, percent: Math.max(0, Math.min(100, n)) } : r
    );
    onChange(normalizeSplitRowsTo100(next));
  };

  const removePocket = (pocketId: string) => {
    const next = rows.filter((r) => r.pocketId !== pocketId);
    if (next.length > 0) onChange(normalizeSplitRowsTo100(next));
    else onChange(next);
  };

  if (rows.length === 0) {
    return (
      <Text style={styles.muted}>
        {readOnly ? 'No pockets in this split.' : 'Add at least one pocket.'}
      </Text>
    );
  }

  return (
    <View>
      {!readOnly ? (
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolBtn, addPocketDisabled && styles.toolBtnDisabled]}
            onPress={onAddPocket}
            disabled={addPocketDisabled}
          >
            <Text style={styles.toolBtnText}>+ Pocket</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => {
              const eq = equalSplitPercents(rows.length);
              onChange(rows.map((r, i) => ({ ...r, percent: eq[i] })));
              onSplitEvenly?.();
            }}
            disabled={rows.length < 2}
          >
            <Text style={styles.toolBtnText}>Split evenly</Text>
          </Pressable>
        </View>
      ) : null}

      {rows.map((r) => (
        <View key={r.pocketId} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {r.name}
            </Text>
            {!readOnly ? (
              <Pressable onPress={() => removePocket(r.pocketId)} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.rowInputWrap}>
            <TextInput
              style={[styles.rowInput, readOnly && styles.rowInputReadOnly]}
              value={String(r.percent)}
              onChangeText={(t) => updatePercent(r.pocketId, t)}
              keyboardType="decimal-pad"
              editable={!readOnly}
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.primary}
            />
            <Text style={styles.pctSuffix}>%</Text>
          </View>
        </View>
      ))}

      <View style={styles.sumRow}>
        <Text style={styles.sumLabel}>Total</Text>
        <Text style={[styles.sumValue, sumOk && styles.sumOk]}>
          {rows.reduce((a, r) => a + r.percent, 0).toFixed(2)}%
        </Text>
      </View>
      {!sumOk && !readOnly ? (
        <Text style={styles.warn}>Adjust percentages to total 100%.</Text>
      ) : null}
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    muted: { color: c.textMuted, fontSize: 14, marginVertical: 8 },
    toolbar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    toolBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
    },
    toolBtnDisabled: { opacity: 0.45 },
    toolBtnText: { fontFamily: font.semibold, color: c.primary, fontSize: 14 },
    row: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    rowName: { fontFamily: font.semibold, fontSize: 15, color: c.text, flex: 1 },
    remove: { color: c.danger, fontSize: 14 },
    rowInputWrap: { flexDirection: 'row', alignItems: 'center' },
    rowInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: c.inputText,
      backgroundColor: c.surface,
    },
    rowInputReadOnly: { opacity: 0.85 },
    pctSuffix: { marginLeft: 8, fontSize: 16, color: c.textMuted },
    sumRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingTop: 8,
    },
    sumLabel: { fontFamily: font.semibold, color: c.textMuted },
    sumValue: { fontFamily: font.bold, color: c.danger },
    sumOk: { color: c.success },
    warn: { color: c.danger, fontSize: 13, marginTop: 6 },
  });
}
