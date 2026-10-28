import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LedgerTransaction } from '../domain/types';
import { useAppTheme } from '../theme/ThemeContext';
import { font } from '../theme/fonts';
import type { AppColors } from '../theme/palette';
import { formatOccurredAt } from '../utils/formatOccurredAt';
import { transactionAmountText } from '../utils/transactionAmount';

type Props = {
  item: LedgerTransaction;
  onPress: () => void;
  /** A category tag (colour dot and name) shown under the title. */
  category?: { name: string; color?: string };
  /** Where the money went, e.g. "Lifestyle" or "Lifestyle → Capital". */
  pocketLine?: string | null;
  /** The pocket whose list this is: a transfer is then shown as money in (+) or out (-) of it. */
  pocketId?: string;
};

/** One transaction in a list: title and amount on top, tag and pocket under it, then the date. */
export function TransactionRow({ item, onPress, category, pocketLine, pocketId }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const amountText = transactionAmountText(item, pocketId);
  const when = formatOccurredAt(item.occurred_at);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.kind}, ${item.title}, ${amountText}, ${when}`}
    >
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[
            styles.amount,
            amountText.startsWith('+') && { color: colors.success },
            item.kind === 'transfer' && !amountText.startsWith('+') && { color: colors.textSecondary },
          ]}
        >
          {amountText}
        </Text>
      </View>
      {category || pocketLine ? (
        <View style={styles.tags}>
          {category ? (
            <>
              <View style={[styles.dot, { backgroundColor: category.color }]} />
              <Text style={styles.tagText}>{category.name}</Text>
            </>
          ) : null}
          {pocketLine ? (
            <Text style={styles.pocket} numberOfLines={1}>
              {category ? '· ' : ''}
              {pocketLine}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.date}>{when}</Text>
    </Pressable>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      padding: 14,
      backgroundColor: c.surface,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    title: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: c.text },
    amount: { fontFamily: font.bold, fontSize: 16, color: c.text, textAlign: 'right', flexShrink: 0 },
    tags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    tagText: { fontSize: 13, color: c.textMuted },
    pocket: { flexShrink: 1, fontSize: 13, color: c.textMuted },
    date: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  });
}
