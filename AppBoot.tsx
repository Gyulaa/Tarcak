// @ts-nocheck
// Temporary: React 19 + React Native 0.81 JSX typings disagree under `tsc` (View/Text as JSX).
// Metro / Expo bundling is unaffected. Security code is fully checked via `npm run typecheck:src`.

import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MainNavigator } from './src/navigation/MainNavigator';
import { font } from './src/theme/fonts';
import {
  createFirstVault,
  eraseAllLocalTarcakData,
  hasVault,
  isSessionUnlocked,
  isSqlCipherAvailableInThisBuild,
  lockVaultSession,
  openMainDatabase,
  registerLockOnBackground,
  unlockWithPassword,
  WrongVaultPasswordError,
} from './src/security';
import { useLedgerStore } from './src/stores/ledgerStore';

/**
 * Vault gate, then main ledger UI (navigation + screens).
 */
export default function AppBoot() {
  const [vaultPresent, setVaultPresent] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  /** Shown while PBKDF2 / SecureStore / DB init run (can be tens of seconds on device). */
  const [vaultPhase, setVaultPhase] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshVaultFlag = useCallback(async () => {
    setVaultPresent(await hasVault());
  }, []);

  useEffect(() => {
    registerLockOnBackground();
    void refreshVaultFlag();
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
      setVaultPhase('Stretching password (PBKDF2)…');
      await createFirstVault(password);
      setVaultPhase('Opening encrypted database…');
      setPassword('');
      await refreshVaultFlag();
      await openMainDatabase();
      setUnlocked(true);
      setMessage('Vault created and database opened.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setVaultPhase(null);
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setMessage(null);
    setBusy(true);
    try {
      setVaultPhase('Deriving key (PBKDF2)…');
      await unlockWithPassword(password);
      setVaultPhase('Opening database…');
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
      setVaultPhase(null);
      setBusy(false);
    }
  };

  const handleLockFromApp = async () => {
    await lockVaultSession();
    setUnlocked(false);
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
        <View style={styles.centered}>
          <ActivityIndicator />
          <StatusBar style="auto" />
        </View>
      </GestureHandlerRootView>
    );
  }

  const sqlCipher = isSqlCipherAvailableInThisBuild();

  if (unlocked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <MainNavigator onLockVault={handleLockFromApp} />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Tarcak — unlock</Text>
        <Text style={styles.hint}>
          {sqlCipher
            ? 'SQLCipher: active in this build (encrypted DB file).'
            : 'SQLCipher: not available (e.g. Expo Go). DB file is plaintext; use a dev build.'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        {!vaultPresent ? (
          <Button
            title="Create vault"
            color="#ff6f32"
            onPress={() => void onCreateVault()}
            disabled={busy}
          />
        ) : (
          <>
            <Button title="Unlock" color="#ff6f32" onPress={() => void onUnlock()} disabled={busy} />
            <Pressable
              onPress={confirmEraseAllData}
              disabled={busy}
              style={({ pressed }) => [styles.forgotWrap, pressed && styles.forgotPressed]}
            >
              <Text style={styles.forgotText}>Forgot password? Erase data and start over</Text>
            </Pressable>
          </>
        )}

        {busy ? <ActivityIndicator style={styles.spinner} /> : null}
        {vaultPhase ? <Text style={styles.phase}>{vaultPhase}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 56,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: font.semibold,
  },
  hint: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  spinner: {
    marginTop: 8,
  },
  phase: {
    marginTop: 12,
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#333',
  },
  forgotWrap: {
    marginTop: 20,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  forgotPressed: { opacity: 0.6 },
  forgotText: {
    color: '#b00020',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
