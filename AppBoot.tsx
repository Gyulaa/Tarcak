// @ts-nocheck
// Temporary: React 19 + React Native 0.81 JSX typings disagree under `tsc` (View/Text as JSX).
// Metro / Expo bundling is unaffected. Security code is fully checked via `npm run typecheck:src`.

import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MainNavigator } from './src/navigation/MainNavigator';
import { AppThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import {
  readAppearanceCache,
  resolveAppearanceColors,
  type AppearanceCache,
} from './src/theme/appearanceCache';
import { DEFAULT_COLOR_THEME_ID } from './src/theme/colorThemes';
import { font } from './src/theme/fonts';
import type { AppColors } from './src/theme/palette';
import {
  createFirstVault,
  eraseAllLocalTarcakData,
  hasVault,
  isSessionUnlocked,
  lockVaultSession,
  openMainDatabase,
  registerLockOnBackground,
  unlockWithPassword,
  WrongVaultPasswordError,
} from './src/security';
import { useLedgerStore } from './src/stores/ledgerStore';

function VaultStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

type VaultPhaseKey = 'kdf' | 'db';

const UNLOCK_PHASE_STEPS: { key: VaultPhaseKey; title: string; body: string }[] = [
  {
    key: 'kdf',
    title: 'Verify your password',
    body: 'This step is intentionally slow so your data stays protected if someone copies the app files.',
  },
  {
    key: 'db',
    title: 'Open your vault',
    body: 'Loading your encrypted ledger on this device…',
  },
];

const CREATE_PHASE_STEPS: { key: VaultPhaseKey; title: string; body: string }[] = [
  {
    key: 'kdf',
    title: 'Create your protected vault',
    body: 'Stretching your password can take 10–30 seconds on some phones — please keep the app open.',
  },
  {
    key: 'db',
    title: 'Prepare encrypted storage',
    body: 'Setting up the local database…',
  },
];

/**
 * Vault gate, then main ledger UI (navigation + screens).
 */
const DEFAULT_APPEARANCE: AppearanceCache = {
  isDark: false,
  colorThemeId: DEFAULT_COLOR_THEME_ID,
};

export default function AppBoot() {
  const [vaultPresent, setVaultPresent] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  /** Which long-running substep is active during create/unlock (`null` when idle or erase-only busy). */
  const [vaultPhaseKey, setVaultPhaseKey] = useState<VaultPhaseKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceCache>(DEFAULT_APPEARANCE);

  const vaultColors = useMemo(() => resolveAppearanceColors(appearance), [appearance]);
  const vaultStyles = useMemo(() => createVaultGateStyles(vaultColors), [vaultColors]);

  const refreshVaultFlag = useCallback(async () => {
    setVaultPresent(await hasVault());
  }, []);

  useEffect(() => {
    registerLockOnBackground();
    void refreshVaultFlag();
    void readAppearanceCache().then(setAppearance);
  }, [refreshVaultFlag]);

  useEffect(() => {
    setUnlocked(isSessionUnlocked());
  }, [vaultPresent, busy]);

  // After `inactive`/`background` lock, sync UI when the app becomes active again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setUnlocked(isSessionUnlocked());
      }
    });
    return () => sub.remove();
  }, []);

  const onCreateVault = async () => {
    setMessage(null);
    setBusy(true);
    try {
      setVaultPhaseKey('kdf');
      await createFirstVault(password);
      setVaultPhaseKey('db');
      setPassword('');
      await refreshVaultFlag();
      await openMainDatabase();
      setUnlocked(true);
      setMessage('Vault created and database opened.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setVaultPhaseKey(null);
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setMessage(null);
    setBusy(true);
    try {
      setVaultPhaseKey('kdf');
      await unlockWithPassword(password);
      setVaultPhaseKey('db');
      setPassword('');
      await openMainDatabase();
      setUnlocked(true);
      setMessage('Unlocked.');
    } catch (e) {
      if (e instanceof WrongVaultPasswordError) {
        setMessage('Wrong password.');
      } else {
        setMessage(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setVaultPhaseKey(null);
      setBusy(false);
    }
  };

  const handleLockFromApp = async () => {
    await lockVaultSession();
    setUnlocked(false);
    setAppearance(await readAppearanceCache());
  };

  const confirmEraseAllData = () => {
    Alert.alert(
      'Erase all Tarcak data?',
      'Your password cannot be recovered. This removes the vault and deletes every pocket and transaction stored on this device. There is no backup unless you made one yourself.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Last step',
              'Tap Erase to permanently delete local data. You will then create a new vault and password.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Erase',
                  style: 'destructive',
                  onPress: () => void runEraseAllData(),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const runEraseAllData = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await eraseAllLocalTarcakData();
      useLedgerStore.setState({ pockets: [], homeBalances: [], lastError: null });
      await refreshVaultFlag();
      setPassword('');
      setMessage('Local data removed. Choose a new password and tap Create vault.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (vaultPresent === null) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[bootStyles.centered, { backgroundColor: vaultColors.bg }]}>
          <ActivityIndicator color={vaultColors.primary} />
          <StatusBar style={appearance.isDark ? 'light' : 'dark'} />
        </View>
      </GestureHandlerRootView>
    );
  }

  if (unlocked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppThemeProvider>
            <MainNavigator onLockVault={handleLockFromApp} />
            <VaultStatusBar />
          </AppThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={vaultStyles.container}>
        <Text style={vaultStyles.title}>Tarcak — unlock</Text>

        <View style={vaultStyles.inputOuter}>
          <TextInput
            style={vaultStyles.input}
            placeholder="Password"
            placeholderTextColor={vaultColors.placeholder}
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            selectionColor={vaultColors.primary}
          />
          <Pressable
            style={vaultStyles.eyeBtn}
            onPress={() => setPasswordVisible((v) => !v)}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={busy ? vaultColors.textMuted : vaultColors.textSecondary}
            />
          </Pressable>
        </View>

        {!vaultPresent ? (
          <Pressable
            style={({ pressed }) => [
              vaultStyles.primaryBtn,
              busy && vaultStyles.primaryBtnBusy,
              pressed && !busy && vaultStyles.primaryBtnPressed,
            ]}
            onPress={() => void onCreateVault()}
            disabled={busy}
          >
            <Text style={vaultStyles.primaryBtnText}>Create vault</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                vaultStyles.primaryBtn,
                busy && vaultStyles.primaryBtnBusy,
                pressed && !busy && vaultStyles.primaryBtnPressed,
              ]}
              onPress={() => void onUnlock()}
              disabled={busy}
            >
              <Text style={vaultStyles.primaryBtnText}>Unlock</Text>
            </Pressable>
            <Pressable
              onPress={confirmEraseAllData}
              disabled={busy}
              style={({ pressed }) => [vaultStyles.forgotWrap, pressed && vaultStyles.forgotPressed]}
            >
              <Text style={vaultStyles.forgotText}>Forgot password? Erase data and start over</Text>
            </Pressable>
          </>
        )}

        {busy && vaultPhaseKey ? (
          <View style={vaultStyles.phaseCard}>
            <Text style={vaultStyles.phaseCardTitle}>Please wait</Text>
            {(vaultPresent ? UNLOCK_PHASE_STEPS : CREATE_PHASE_STEPS).map((step, i) => {
              const steps = vaultPresent ? UNLOCK_PHASE_STEPS : CREATE_PHASE_STEPS;
              const activeIdx = steps.findIndex((s) => s.key === vaultPhaseKey);
              const done = i < activeIdx;
              const current = i === activeIdx;
              return (
                <View key={step.key} style={vaultStyles.phaseRow}>
                  <View
                    style={[
                      vaultStyles.phaseDot,
                      done && vaultStyles.phaseDotDone,
                      current && vaultStyles.phaseDotCurrent,
                    ]}
                  >
                    {done ? (
                      <Text style={vaultStyles.phaseCheck}>✓</Text>
                    ) : (
                      <Text style={[vaultStyles.phaseNum, current && vaultStyles.phaseNumCurrent]}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <View style={vaultStyles.phaseTextCol}>
                    <Text
                      style={[vaultStyles.phaseStepTitle, current && vaultStyles.phaseStepTitleCurrent]}
                    >
                      {step.title}
                    </Text>
                    <Text style={vaultStyles.phaseStepBody}>{step.body}</Text>
                    {current ? (
                      <ActivityIndicator style={vaultStyles.phaseSpinner} color={vaultColors.primary} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : busy ? (
          <ActivityIndicator style={vaultStyles.spinner} color={vaultColors.primary} />
        ) : null}
        {message ? <Text style={vaultStyles.message}>{message}</Text> : null}

        <StatusBar style={appearance.isDark ? 'light' : 'dark'} />
      </View>
    </GestureHandlerRootView>
  );
}

const bootStyles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function createVaultGateStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      padding: 24,
      paddingTop: 56,
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontFamily: font.semibold,
      color: c.text,
      marginBottom: 8,
    },
    inputOuter: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      paddingRight: 4,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.inputText,
      backgroundColor: 'transparent',
    },
    eyeBtn: {
      padding: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    primaryBtnPressed: {
      opacity: 0.88,
    },
    primaryBtnBusy: {
      opacity: 0.55,
    },
    primaryBtnText: {
      color: '#fff',
      fontFamily: font.semibold,
      fontSize: 17,
    },
    spinner: {
      marginTop: 16,
    },
    phaseCard: {
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    phaseCardTitle: {
      fontFamily: font.bold,
      fontSize: 16,
      color: c.text,
      marginBottom: 14,
    },
    phaseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    phaseDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    phaseDotDone: {
      backgroundColor: c.success,
    },
    phaseDotCurrent: {
      backgroundColor: c.chipBg,
      borderWidth: 2,
      borderColor: c.primary,
    },
    phaseCheck: {
      color: '#fff',
      fontSize: 14,
      fontFamily: font.bold,
    },
    phaseNum: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.textMuted,
    },
    phaseNumCurrent: {
      color: c.primary,
    },
    phaseTextCol: { flex: 1 },
    phaseStepTitle: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: c.textMuted,
    },
    phaseStepTitleCurrent: {
      color: c.text,
    },
    phaseStepBody: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      marginTop: 4,
    },
    phaseSpinner: {
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    message: {
      marginTop: 12,
      color: c.textSecondary,
    },
    forgotWrap: {
      marginTop: 20,
      paddingVertical: 8,
      alignSelf: 'center',
    },
    forgotPressed: { opacity: 0.6 },
    forgotText: {
      color: c.danger,
      fontSize: 14,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
  });
}
