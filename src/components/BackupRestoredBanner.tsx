import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  type BackupRestoreInfo,
  clearBackupRestoreInfo,
  getBackupRestoreInfo,
} from '../security/backupImportMeta';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { HIT_SLOP } from '../utils/hitSlop';

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

export function BackupRestoredBanner() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [info, setInfo] = useState<BackupRestoreInfo | null>(null);

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
        Pockets, transactions, Jar rules and settings on this device came from your backup file.
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Backup made</Text>
        <Text style={styles.metaValue}>{formatWhen(info.sourceExportedAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Restored</Text>
        <Text style={styles.metaValue}>{formatWhen(info.restoredAt)}</Text>
      </View>
      <Pressable
        style={styles.dismissBtn}
        onPress={() => void dismiss()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 12,
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
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
      paddingVertical: 2,
    },
    metaLabel: { fontSize: 12, lineHeight: 18, color: c.textMuted },
    metaValue: {
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 18,
      color: c.textSecondary,
      textAlign: 'right',
    },
    dismissBtn: {
      alignSelf: 'flex-end',
      marginTop: 8,
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
