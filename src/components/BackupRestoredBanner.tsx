// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  clearBackupRestoreInfo,
  getBackupRestoreInfo,
} from '../security/backupImportMeta';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

function formatWhen(isoOrMs: string | number): string {
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) {
    return String(isoOrMs);
  }
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type Props = {
  compact?: boolean;
};

export function BackupRestoredBanner({ compact = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const [info, setInfo] = useState(null);

  const reload = useCallback(() => {
    void getBackupRestoreInfo().then(setInfo);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (!info) {
    return null;
  }

  const dismiss = async () => {
    await clearBackupRestoreInfo();
    setInfo(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Restored from backup</Text>
      <Text style={styles.body}>
        Everything on this device — pockets, transactions, Jar rules, and settings — came from your
        imported file.
      </Text>
      <Text style={styles.meta}>
        Backup created: {formatWhen(info.sourceExportedAt)}
        {'\n'}
        Imported here: {formatWhen(info.restoredAt)}
      </Text>
      <Pressable style={styles.dismissBtn} onPress={() => void dismiss()} hitSlop={8}>
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

function createStyles(c: AppColors, compact: boolean) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: compact ? 0 : 16,
      marginBottom: compact ? 12 : 0,
      marginTop: compact ? 0 : 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.chipBg,
      borderWidth: 1,
      borderColor: c.jarSoftBorder,
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 15,
      color: c.primary,
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      lineHeight: 19,
      color: c.textSecondary,
      marginBottom: 8,
    },
    meta: {
      fontSize: 12,
      lineHeight: 18,
      color: c.textMuted,
      fontFamily: font.regular,
    },
    dismissBtn: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    dismissText: {
      fontFamily: font.semibold,
      fontSize: 14,
      color: c.primary,
    },
  });
}
