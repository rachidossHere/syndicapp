// Carte « Mes charges » (écrans 5 et 7 de docs/charges.png) : période, montant restant à payer,
// statut et « À régler avant le …, en espèces ou par virement au syndic ».
import { Amount, StatusBadge, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import type { MyDue } from '@/hooks/use-charges';
import { useT } from '@/i18n/use-t';

import { dueDisplay } from './my-charges';
import { useChargeFormat } from './use-charge-format';

export function MyChargeCard({ due, showLot }: { due: MyDue; showLot: boolean }) {
  const { colors, radius, spacing } = useTheme();
  const t = useT();
  const format = useChargeFormat();
  const { settled, amount } = dueDisplay(due);

  return (
    <View
      accessible
      style={{
        gap: spacing.sm,
        padding: spacing.xl,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        backgroundColor: colors.primary,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="small" tone="inverse" style={{ flex: 1 }}>
          {showLot
            ? `${format.period(due.periodLabel)} · ${t('mine.lot', { lot: due.lotReference })}`
            : format.period(due.periodLabel)}
        </Text>
        <StatusBadge status={due.status} />
      </View>
      {/* Montant restant à payer ; une fois réglé, le montant de l'appel. */}
      <Amount centimes={amount} variant="display" tone="inverse" />
      <Text variant="small" tone="inverse">
        {settled ? t('mine.settled') : t('mine.payBefore', { date: format.date(due.dueDate, 'long') })}
      </Text>
    </View>
  );
}
