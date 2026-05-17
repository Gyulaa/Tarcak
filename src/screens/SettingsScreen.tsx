// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { BackupPasswordModal } from '../components/BackupPasswordModal';
import { BackupRestoredBanner } from '../components/BackupRestoredBanner';
import { ModalSelectField } from '../components/ModalSelectField';
import { ScreenWithFooter } from '../components/ScreenWithFooter';
import * as assetTypesRepo from '../db/repositories/assetTypes';
import * as settingsRepo from '../db/repositories/settings';
import { useLockVault } from '../navigation/LockVaultContext';
import {
  resumeVaultLockOnBackground,
  suspendVaultLockOnBackground,
  VaultCryptoError,
  WrongVaultPasswordError,
} from '../security';
import {
  BACKUP_EXTENSION,
  BACKUP_INCLUDES,
  exportEncryptedBackup,
  importEncryptedBackup,
} from '../security/backup';
import { COLOR_THEME_META, COLOR_THEME_ORDER, normalizeColorThemeId } from '../theme/colorThemes';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, colorThemeId, setDarkMode, setColorTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lockVault = useLockVault();
  const [assetTypes, setAssetTypes] = useState([]);
  const [defaultCode, setDefaultCode] = useState('HUF');
  const [loaded, setLoaded] = useState(false);
  const [jarEnabled, setJarEnabled] = useState(true);
  const [advancedJarEnabled, setAdvancedJarEnabled] = useState(false);
  const [showArchivedPockets, setShowArchivedPockets] = useState(false);
  const [backupModal, setBackupModal] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const types = await assetTypesRepo.listAssetTypes();
        setAssetTypes(types);
        const c = await settingsRepo.getDefaultCurrency();
        setDefaultCode(c);
        setJarEnabled(await settingsRepo.getJarEnabled());
        setAdvancedJarEnabled(await settingsRepo.getAdvancedJarEnabled());
        setShowArchivedPockets(await settingsRepo.getShowArchivedPockets());
        setLoaded(true);
      })();
    }, [])
  );

  const onJarToggle = async (value) => {
    try {
      await settingsRepo.setJarEnabled(value);
      setJarEnabled(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const onAdvancedJarToggle = async (value) => {
    try {
      await settingsRepo.setAdvancedJarEnabled(value);
      setAdvancedJarEnabled(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const onShowArchivedToggle = async (value) => {
    try {
      await settingsRepo.setShowArchivedPockets(value);
      setShowArchivedPockets(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const onDarkToggle = async (value) => {
    try {
      await setDarkMode(value);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const onColorThemeSelect = async (id: string) => {
    try {
      await setColorTheme(normalizeColorThemeId(id));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const colorThemeOptions = useMemo(
    () =>
      COLOR_THEME_ORDER.map((id) => ({
        value: id,
        title: COLOR_THEME_META[id].title,
        subtitle: COLOR_THEME_META[id].subtitle,
      })),
    []
  );

  const colorThemeDisplay = COLOR_THEME_META[colorThemeId].title;

  const defaultAssetDisplay = useMemo(() => {
    const row = assetTypes.find((a) => a.code === defaultCode);
    return row ? `${row.code} — ${row.name}` : '';
  }, [assetTypes, defaultCode]);

  const defaultAssetOptions = useMemo(
    () => assetTypes.map((a) => ({ value: a.code, title: a.code, subtitle: a.name })),
    [assetTypes]
  );

  const onPickDefaultAsset = async (code) => {
    try {
      await settingsRepo.setDefaultCurrency(code);
      setDefaultCode(code);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const closeBackupModal = () => {
    setBackupModal(null);
    resumeVaultLockOnBackground();
  };

  const runExportBackup = async (backupPassword) => {
    setBackupBusy(true);
    suspendVaultLockOnBackground();
    try {
      const uri = await exportEncryptedBackup(backupPassword);
      closeBackupModal();
      const includesList = BACKUP_INCLUDES.map((line) => `• ${line}`).join('\n');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Backup created',
          `Saved to:\n${uri}\n\nIncludes:\n${includesList}\n\nSharing is not available on this device.`
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Save Tarcak backup',
        UTI: 'com.gyulaa.tarcak.backup',
      });
      Alert.alert(
        'Backup ready',
        `Your ${BACKUP_EXTENSION} file includes:\n${includesList}\n\nKeep your backup password safe — it is separate from your vault password.`
      );
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      resumeVaultLockOnBackground();
      setBackupBusy(false);
    }
  };

  const startImportBackup = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not on web', 'Import and export backups from the Android or iOS app.');
      return;
    }
    suspendVaultLockOnBackground();
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) {
        resumeVaultLockOnBackground();
        return;
      }
      const name = picked.assets[0].name ?? '';
      if (name && !name.toLowerCase().endsWith(BACKUP_EXTENSION)) {
        Alert.alert(
          'Wrong file type?',
          `Expected a ${BACKUP_EXTENSION} file. You can still try to import if you are sure.`
        );
      }
      setBackupModal({ mode: 'import', fileUri: picked.assets[0].uri });
    } catch (e) {
      resumeVaultLockOnBackground();
      Alert.alert('Could not open file', e instanceof Error ? e.message : String(e));
    }
  };

  const runImportBackup = (backupPassword) => {
    if (!backupModal || backupModal.mode !== 'import') return;
    Alert.alert(
      'Replace all data on this device?',
      'Importing replaces your vault and database with the backup. This cannot be undone unless you have another copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () => void doImportBackup(backupPassword, backupModal.fileUri),
        },
      ]
    );
  };

  const doImportBackup = async (backupPassword, fileUri) => {
    setBackupBusy(true);
    suspendVaultLockOnBackground();
    try {
      await importEncryptedBackup(fileUri, backupPassword);
      closeBackupModal();
      Alert.alert(
        'Import complete',
        'Your backup replaced all data on this device. The app will lock now — unlock with your vault password (the same one you used when you exported). After unlock, Home shows a banner marking data from this import.',
        [{ text: 'OK', onPress: () => void lockVault() }]
      );
    } catch (e) {
      const msg =
        e instanceof WrongVaultPasswordError
          ? 'Incorrect backup password.'
          : e instanceof VaultCryptoError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
      Alert.alert('Import failed', msg);
    } finally {
      resumeVaultLockOnBackground();
      setBackupBusy(false);
    }
  };

  return (
    <ScreenWithFooter>
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <BackupRestoredBanner compact />
      <Text style={styles.p}>
        Default asset type is applied when you open a new transaction. Create types under Asset
        types, then choose one below.
      </Text>
      {loaded && assetTypes.length === 0 ? (
        <>
          <Text style={styles.label}>Default asset type</Text>
          <Text style={styles.muted}>
            No asset types yet. Open Asset types below and add at least one (e.g. HUF).
          </Text>
        </>
      ) : (
        <ModalSelectField
          label="Default asset type"
          displayValue={defaultAssetDisplay}
          placeholder="Select default asset"
          modalTitle="Default asset type"
          options={defaultAssetOptions}
          onSelect={(code) => void onPickDefaultAsset(code)}
          disabled={!loaded || assetTypes.length === 0}
          emptyMessage="No asset types yet. Open Asset types below first."
        />
      )}

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('AssetTypes')}>
        <Text style={styles.secondaryBtnText}>Asset types…</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.label}>Appearance</Text>
      <ModalSelectField
        label="Color palette"
        displayValue={colorThemeDisplay}
        placeholder="Select palette"
        modalTitle="Accent color"
        options={colorThemeOptions}
        onSelect={(v) => void onColorThemeSelect(v)}
        disabled={!loaded}
      />
      <View style={[styles.switchRow, { marginTop: 12 }]}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Black theme</Text>
          <Text style={styles.switchHint}>Dark background and light text across the app.</Text>
        </View>
        <Switch
          value={isDark}
          onValueChange={(v) => void onDarkToggle(v)}
          disabled={!loaded}
          trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
          thumbColor={isDark ? colors.switchThumbOn : colors.switchThumbOff}
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Jar</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Pool & distribute</Text>
          <Text style={styles.switchHint}>
            Home shortcut, distribution, and the highlighted Jar row in Pockets. When off, the Jar
            pocket is archived: hidden from lists and from new transaction pickers until you turn this
            back on.
          </Text>
        </View>
        <Switch
          value={jarEnabled}
          onValueChange={(v) => void onJarToggle(v)}
          disabled={!loaded}
          trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
          thumbColor={jarEnabled ? colors.switchThumbOn : colors.switchThumbOff}
        />
      </View>

      <View style={[styles.switchRow, !jarEnabled && styles.switchRowDim]}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Advanced Jar</Text>
          <Text style={styles.switchHint}>
            Per-asset default ceiling and milestone splits (linear blend between steps). When on,
            Jar distribution uses only these rules—add every asset you keep in the Jar under Advanced
            Jar. Off by default.
          </Text>
        </View>
        <Switch
          value={advancedJarEnabled}
          onValueChange={(v) => void onAdvancedJarToggle(v)}
          disabled={!loaded || !jarEnabled}
          trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
          thumbColor={advancedJarEnabled ? colors.switchThumbOn : colors.switchThumbOff}
        />
      </View>

      <Pressable
        style={[styles.secondaryBtn, (!jarEnabled || !advancedJarEnabled) && styles.secondaryBtnDim]}
        onPress={() => navigation.navigate('JarAdvanced')}
        disabled={!loaded || !jarEnabled || !advancedJarEnabled}
      >
        <Text style={styles.secondaryBtnText}>Configure Advanced Jar…</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.label}>Pockets</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchTitle}>Show archived pockets</Text>
          <Text style={styles.switchHint}>
            Lists pockets you archived (zero balance, with history). Turn on to see them in Pockets,
            pickers, and Statistics; open a pocket and tap Unarchive to use it again.
          </Text>
        </View>
        <Switch
          value={showArchivedPockets}
          onValueChange={(v) => void onShowArchivedToggle(v)}
          disabled={!loaded}
          trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
          thumbColor={showArchivedPockets ? colors.switchThumbOn : colors.switchThumbOff}
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Backup & restore</Text>
      <Text style={styles.backupHint}>
        Export creates an encrypted {BACKUP_EXTENSION} file with your full vault:{' '}
        {BACKUP_INCLUDES.join('; ')}. You choose a backup password for the file; your vault password
        stays the same. Import replaces everything on this device — the file picker will not lock
        you out mid-import. After a successful import, unlock and look for the “Restored from backup”
        banner on Home.
      </Text>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => setBackupModal({ mode: 'export' })}
        disabled={!loaded || backupBusy || Platform.OS === 'web'}
      >
        {backupBusy && backupModal?.mode === 'export' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryBtnText}>Export encrypted backup…</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.secondaryBtn, Platform.OS === 'web' && styles.secondaryBtnDim]}
        onPress={() => void startImportBackup()}
        disabled={!loaded || backupBusy || Platform.OS === 'web'}
      >
        <Text style={styles.secondaryBtnText}>Import encrypted backup…</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.lockRow} onPress={() => void lockVault()}>
        <Text style={styles.lockText}>Lock vault</Text>
        <Text style={styles.lockHint}>Closes the database and clears keys from memory.</Text>
      </Pressable>

      <BackupPasswordModal
        visible={backupModal != null}
        title={backupModal?.mode === 'export' ? 'Export backup' : 'Import backup'}
        subtitle={
          backupModal?.mode === 'export'
            ? 'Choose a strong backup password. You will need it to open this file on another device. Your vault password stays the same.'
            : 'Enter the backup password for the file you selected.'
        }
        confirmPassword={backupModal?.mode === 'export'}
        submitLabel={backupModal?.mode === 'export' ? 'Create file' : 'Continue'}
        busy={backupBusy}
        onCancel={() => !backupBusy && closeBackupModal()}
        onSubmit={(pw) => {
          if (backupModal?.mode === 'export') {
            void runExportBackup(pw);
          } else {
            runImportBackup(pw);
          }
        }}
      />
    </ScrollView>
    </ScreenWithFooter>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 16, paddingBottom: 40 },
    p: { color: c.textMuted, marginBottom: 16, lineHeight: 22 },
    label: { fontFamily: font.semibold, marginBottom: 6, color: c.text },
    muted: { color: c.textMuted, paddingVertical: 8 },
    secondaryBtn: {
      marginTop: 12,
      backgroundColor: c.surface,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    secondaryBtnText: { color: c.primary, fontFamily: font.semibold, fontSize: 16 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 28 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 8,
    },
    switchTextCol: { flex: 1 },
    switchTitle: { fontFamily: font.semibold, fontSize: 16, color: c.text, marginBottom: 6 },
    switchHint: { fontSize: 13, color: c.textMuted, lineHeight: 19 },
    switchRowDim: { opacity: 0.55 },
    secondaryBtnDim: { opacity: 0.45 },
    lockRow: { paddingVertical: 8 },
    lockText: { fontSize: 17, fontFamily: font.semibold, color: c.danger },
    lockHint: { color: c.textMuted, marginTop: 6, fontSize: 13 },
    backupHint: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginBottom: 12 },
  });
}
