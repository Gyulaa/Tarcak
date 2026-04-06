// @ts-nocheck
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ContourOnPrimaryText } from './ContourOnPrimaryText';
import { DONATION_BTC_ADDRESS, DONATION_XMR_ADDRESS } from '../constants/donations';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';

export function DonationFooter() {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const copy = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', `${label} address copied to the clipboard.`);
    } catch {
      Alert.alert('Copy failed', 'Select the address and copy manually.');
    }
  };

  return (
    <>
      <Pressable style={styles.wrap} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          If Tarcak helps you, you can support development with a donation (tap for addresses).
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.modalOverlay }]} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: colors.text }]}>Support Tarcak</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Thank you for considering a donation. Copy an address below and send from your wallet.
            </Text>

            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              <Text style={[styles.coinLabel, { color: colors.textSecondary }]}>Bitcoin (BTC)</Text>
              <Text selectable style={[styles.addr, { color: colors.text, backgroundColor: colors.surfaceMuted }]}>
                {DONATION_BTC_ADDRESS}
              </Text>
              <Pressable
                style={[styles.copyBtn, { backgroundColor: colors.primary }]}
                onPress={() => void copy('Bitcoin', DONATION_BTC_ADDRESS)}
              >
                <ContourOnPrimaryText style={styles.copyBtnText}>Copy BTC address</ContourOnPrimaryText>
              </Pressable>

              <Text style={[styles.coinLabel, styles.coinLabelSp, { color: colors.textSecondary }]}>
                Monero (XMR)
              </Text>
              <Text selectable style={[styles.addr, { color: colors.text, backgroundColor: colors.surfaceMuted }]}>
                {DONATION_XMR_ADDRESS}
              </Text>
              <Pressable
                style={[styles.copyBtn, { backgroundColor: colors.primary }]}
                onPress={() => void copy('Monero', DONATION_XMR_ADDRESS)}
              >
                <ContourOnPrimaryText style={styles.copyBtnText}>Copy XMR address</ContourOnPrimaryText>
              </Pressable>
            </ScrollView>

            <Pressable style={styles.closeRow} onPress={() => setOpen(false)}>
              <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 16, paddingHorizontal: 8 },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  sheet: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
  },
  title: { fontFamily: font.bold, fontSize: 20, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  scroll: { maxHeight: 360 },
  coinLabel: { fontFamily: font.semibold, fontSize: 14, marginBottom: 6 },
  coinLabelSp: { marginTop: 16 },
  addr: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  copyBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  copyBtnText: { fontFamily: font.semibold, fontSize: 15 },
  closeRow: { marginTop: 16, alignItems: 'center', padding: 8 },
  closeText: { fontFamily: font.semibold, fontSize: 16 },
});
