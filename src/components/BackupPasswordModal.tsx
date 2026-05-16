// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContourOnPrimaryText } from './ContourOnPrimaryText';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  confirmPassword: boolean;
  submitLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void | Promise<void>;
};

export function BackupPasswordModal({
  visible,
  title,
  subtitle,
  confirmPassword,
  submitLabel,
  busy = false,
  onCancel,
  onSubmit,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visiblePw, setVisiblePw] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirm('');
      setVisiblePw(false);
    }
  }, [visible]);

  const mismatch = confirmPassword && confirm.length > 0 && password !== confirm;
  const canSubmit =
    !busy &&
    password.length > 0 &&
    (!confirmPassword || (confirm.length > 0 && password === confirm));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <Text style={styles.fieldLabel}>Backup password</Text>
          <View style={styles.inputOuter}>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!visiblePw}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              selectionColor={colors.primary}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setVisiblePw((v) => !v)}
              disabled={busy}
              hitSlop={10}
            >
              <Ionicons
                name={visiblePw ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {confirmPassword ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Confirm backup password</Text>
              <View style={styles.inputOuter}>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!visiblePw}
                  value={confirm}
                  onChangeText={setConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  selectionColor={colors.primary}
                />
              </View>
            </View>
          ) : null}

          {mismatch ? <Text style={styles.error}>Passwords do not match.</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.okBtn, !canSubmit && styles.okBtnDisabled]}
              onPress={() => void onSubmit(password)}
              disabled={!canSubmit}
            >
              <ContourOnPrimaryText style={styles.okText}>{submitLabel}</ContourOnPrimaryText>
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
    subtitle: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 14 },
    fieldBlock: { marginTop: 14 },
    fieldLabel: {
      fontFamily: font.semibold,
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 6,
    },
    inputOuter: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      minHeight: 48,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.inputText,
      minHeight: 48,
    },
    eyeBtn: { padding: 10 },
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
