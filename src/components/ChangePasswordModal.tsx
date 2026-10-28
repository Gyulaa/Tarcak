import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContourOnPrimaryText } from './ContourOnPrimaryText';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

type Props = {
  visible: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => void | Promise<void>;
};

export function ChangePasswordModal({ visible, busy = false, onCancel, onSubmit }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  }, [visible]);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = !busy && current.length > 0 && next.length > 0 && next === confirm;

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        selectionColor={colors.primary}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Change vault password</Text>
          <Text style={styles.subtitle}>
            The password cannot be recovered. If you forget it, the only way back in is to erase the
            app data.
          </Text>

          {field('Current password', current, setCurrent)}
          {field('New password', next, setNext)}
          {field('Confirm new password', confirm, setConfirm)}

          {mismatch ? <Text style={styles.error}>Passwords do not match.</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.okBtn, !canSubmit && styles.okBtnDisabled]}
              onPress={() => void onSubmit(current, next)}
              disabled={!canSubmit}
            >
              <ContourOnPrimaryText style={styles.okText}>
                {busy ? 'Changing…' : 'Change password'}
              </ContourOnPrimaryText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: 'center',
      padding: 20,
    },
    sheet: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: { fontSize: 18, fontFamily: font.bold, color: c.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 6 },
    fieldBlock: { marginTop: 14 },
    fieldLabel: {
      fontFamily: font.semibold,
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      paddingVertical: 12,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.inputText,
      minHeight: 48,
    },
    error: { color: c.danger, fontSize: 13, marginTop: 8 },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 18,
    },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 12 },
    cancelText: { color: c.textMuted, fontFamily: font.semibold, fontSize: 16 },
    okBtn: {
      backgroundColor: c.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    okBtnDisabled: { opacity: 0.45 },
    okText: { fontFamily: font.semibold, fontSize: 16 },
  });
}
