// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as jarRepo from '../db/repositories/jar';
import * as pocketsRepo from '../db/repositories/pockets';
import * as settingsRepo from '../db/repositories/settings';
import * as txRepo from '../db/repositories/transactions';
import { font } from '../theme/fonts';
import { formatMinorForDisplay } from '../utils/formatMinor';
import { useLedgerStore } from '../stores/ledgerStore';

export default function JarScreen({ navigation }) {
  const refreshLedger = useLedgerStore((s) => s.refresh);
  const [jarName, setJarName] = useState('Jar');
  const [jarId, setJarId] = useState(null);
  const [balances, setBalances] = useState([]);
  const [ruleCount, setRuleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickCurrencyOpen, setPickCurrencyOpen] = useState(false);
  const [jarFeatureOn, setJarFeatureOn] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jar, featureOn] = await Promise.all([
        pocketsRepo.getJarPocket(),
        settingsRepo.getJarEnabled(),
      ]);
      setJarFeatureOn(featureOn);
      if (!jar) {
        setJarId(null);
        setBalances([]);
        setRuleCount(0);
        return;
      }
      setJarId(jar.id);
      setJarName(jar.name);
      const b = await txRepo.sumBalancesForPocket(jar.id);
      setBalances(b.filter((x) => x.balance_minor > 0));
      const rules = await jarRepo.listJarDistributionRules();
      setRuleCount(rules.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshLedger();
    }, [load, refreshLedger])
  );

  const runDistribute = async (currency) => {
    setBusy(true);
    try {
      const n = await jarRepo.distributeJarCurrency({ currency });
      await load();
      await refreshLedger();
      Alert.alert('Done', `Created ${n} transfer${n === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert('Cannot distribute', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPickCurrencyOpen(false);
    }
  };

  const onDistributePress = () => {
    if (!jarId) return;
    if (ruleCount === 0) {
      Alert.alert('Set up split first', 'Add target pockets and make sure percentages total 100%.', [
        { text: 'OK' },
        { text: 'Edit split', onPress: () => navigation.navigate('JarSplit') },
      ]);
      return;
    }
    if (balances.length === 0) {
      Alert.alert('Jar is empty', 'Record income into the Jar first.');
      return;
    }
    if (balances.length === 1) {
      const c = balances[0].currency;
      Alert.alert(
        'Distribute',
        `Move the full ${c} balance from the Jar to your pockets using your saved split?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Distribute', onPress: () => void runDistribute(c) },
        ]
      );
      return;
    }
    setPickCurrencyOpen(true);
  };

  if (loading && !jarId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ff6f32" />
      </View>
    );
  }

  if (!jarId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Jar pocket is not available.</Text>
      </View>
    );
  }

  if (!jarFeatureOn) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Jar features are off</Text>
          <Text style={styles.disabledBody}>
            Distribution and the pool shortcut are hidden. The Jar pocket is archived (hidden from
            pocket lists and new transactions). Turn Pool & distribute back on in Settings to restore
            it, or open it here to view balances and history.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={() => navigation.navigate('PocketDetail', { pocketId: jarId })}
          >
            <Text style={styles.ghostBtnText}>Open Jar as pocket</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Hold & allocate</Text>
        <Text style={styles.heroTitle}>{jarName}</Text>
        <Text style={styles.heroSub}>
          Pool income here, then distribute to your pockets on your schedule.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>In the Jar</Text>
        {balances.length === 0 ? (
          <Text style={styles.muted}>Nothing here yet — use Income and pick this pocket.</Text>
        ) : (
          balances.map((item) => (
            <View key={item.currency} style={styles.balanceRow}>
              <Text style={styles.balanceCode}>{item.currency}</Text>
              <Text style={styles.balanceAmt}>
                {formatMinorForDisplay(item.balance_minor, item.currency)}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.splitHint}>
        {ruleCount === 0
          ? 'No split configured yet.'
          : `${ruleCount} pocket${ruleCount === 1 ? '' : 's'} in your split.`}
      </Text>

      <Pressable
        style={[styles.primaryBtn, (busy || balances.length === 0) && styles.btnDisabled]}
        onPress={onDistributePress}
        disabled={busy}
      >
        <Text style={styles.primaryBtnText}>Distribute</Text>
      </Pressable>

      <Pressable style={styles.ghostBtn} onPress={() => navigation.navigate('JarSplit')} disabled={busy}>
        <Text style={styles.ghostBtnText}>Edit split</Text>
      </Pressable>

      <Pressable
        style={styles.linkRow}
        onPress={() => navigation.navigate('TransactionEditor', { presetKind: 'income', pocketId: jarId })}
      >
        <Text style={styles.linkText}>Record income to Jar →</Text>
      </Pressable>

      <Modal visible={pickCurrencyOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickCurrencyOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Distribute which asset?</Text>
            {balances.map((item) => (
              <Pressable
                key={item.currency}
                style={styles.modalRow}
                onPress={() => {
                  Alert.alert(
                    'Distribute',
                    `Move the full ${item.currency} balance from the Jar using your saved split?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Distribute', onPress: () => void runDistribute(item.currency) },
                    ]
                  );
                }}
              >
                <Text style={styles.modalRowCode}>{item.currency}</Text>
                <Text style={styles.modalRowAmt}>
                  {formatMinorForDisplay(item.balance_minor, item.currency)}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setPickCurrencyOpen(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color="#ff6f32" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8f9fa' },
  inner: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0e6e2',
    shadowColor: '#ff6f32',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroKicker: { fontSize: 12, fontFamily: font.semibold, color: '#ff6f32', letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontFamily: font.bold, color: '#111', marginTop: 6 },
  heroSub: { fontSize: 15, color: '#666', marginTop: 10, lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  cardLabel: { fontSize: 13, fontFamily: font.semibold, color: '#888', marginBottom: 10 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  balanceCode: { fontFamily: font.bold, fontSize: 16, color: '#222' },
  balanceAmt: { fontSize: 15, color: '#333' },
  muted: { color: '#666', fontSize: 15, lineHeight: 22 },
  splitHint: { fontSize: 14, color: '#555', marginBottom: 16, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#ff6f32',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 17 },
  ghostBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ff6f32',
  },
  ghostBtnText: { color: '#ff6f32', fontFamily: font.semibold, fontSize: 16 },
  linkRow: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#ff6f32', fontFamily: font.semibold, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: { fontSize: 18, fontFamily: font.bold, marginBottom: 16, color: '#111' },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalRowCode: { fontFamily: font.bold, fontSize: 17, color: '#222' },
  modalRowAmt: { fontSize: 16, color: '#444' },
  modalCancel: { marginTop: 16, alignItems: 'center', padding: 12 },
  modalCancelText: { color: '#666', fontFamily: font.semibold },
  busy: { marginTop: 16, alignItems: 'center' },
  disabledCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  disabledTitle: { fontSize: 20, fontFamily: font.bold, color: '#111', marginBottom: 12 },
  disabledBody: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 20 },
});
