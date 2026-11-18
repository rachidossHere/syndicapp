// Carte « Charges de <période> » de l'accueil du copropriétaire (écran 2 de docs/design-v2.png) :
// montant restant, statut, barre de progression, échéance et « Voir mes charges ». Tout est payé :
// état positif. Un dû par appartement ; avec plusieurs appartements, le bouton passe sous les cartes.
// Rendue uniquement pour un copropriétaire : les autres rôles ne font aucune requête de charges.
import { Amount, Button, Card, EmptyState, Icon, ProgressBar, Skeleton, StatusBadge, Text, formatAmount, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { QueryFallback } from '@/features/charges/query-fallback';
import { currentDuePerLot } from '@/features/charges/my-charges';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import type { MyDue } from '@/hooks/use-charges';
import { useMyDues } from '@/hooks/use-charges';
import { useT } from '@/i18n/use-t';
import { chargesCardFor } from '@/lib/home';

function DueCard({ due, showLot, action }: { due: MyDue; showLot: boolean; action?: ReactNode }) {
  const { colors, spacing, sizes } = useTheme();
  const t = useT();
  const format = useChargeFormat();
  const card = chargesCardFor(due);
  const title = t('home.charges.title', { period: format.period(due.periodLabel) });
  const lotLine = showLot ? t('mine.lot', { lot: due.lotReference }) : undefined;

  if (card.settled) {
    // Tout est payé : fond de succès, coche et message ; le statut « Payé » est écrit, jamais la couleur seule.
    return (
      <Card style={{ backgroundColor: colors.successBg, borderColor: colors.successBg }}>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon icon={CircleCheck} variant="duotone" color={colors.successFg} size={sizes.iconTileGlyph.lg} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="small" style={{ color: colors.successFg }}>
                {lotLine === undefined ? title : `${title} · ${lotLine}`}
              </Text>
              <Text variant="h3" style={{ color: colors.successFg }}>
                {t('home.charges.allPaidTitle')}
              </Text>
            </View>
            <StatusBadge status="paid" />
          </View>
          <Text style={{ color: colors.successFg }}>{t('home.charges.allPaidBody')}</Text>
          {action}
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="small" tone="muted">
              {title}
            </Text>
            {lotLine !== undefined && (
              <Text variant="small" tone="muted">
                {lotLine}
              </Text>
            )}
          </View>
          <StatusBadge status={card.status} />
        </View>
        <Amount centimes={card.centimes} variant="display" />
        <ProgressBar
          value={card.progress}
          accessibilityLabel={t('home.charges.progress', {
            paid: formatAmount(due.amountPaid, 'neutral'),
            total: formatAmount(due.amountDue, 'neutral'),
          })}
        />
        <Text variant="small" tone="muted">
          {t('mine.payBefore', { date: format.date(due.dueDate, 'long') })}
        </Text>
        {action}
      </View>
    </Card>
  );
}

export function MonthChargesCard({ residenceId }: { residenceId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const dues = useMyDues(residenceId);

  if (dues.data === undefined) {
    if (dues.error) return <QueryFallback query={dues} message={t('mine.loadError')} />;
    return (
      <Card>
        <View accessible accessibilityLabel={t('common.loading')} style={{ gap: spacing.md }}>
          <Skeleton width="45%" />
          <Skeleton width="60%" height={spacing.xxxl} />
          <Skeleton height={spacing.sm} rounded="pill" />
          <Skeleton width="80%" />
        </View>
      </Card>
    );
  }
  if (dues.data.length === 0) {
    return <EmptyState domain="charges" title={t('mine.emptyTitle')} description={t('mine.emptyBody')} />;
  }

  const current = currentDuePerLot(dues.data);
  const seeMine = (
    <Button variant="primary" label={t('home.charges.seeMine')} onPress={() => router.navigate('/my-charges')} />
  );
  const single = current.length === 1;

  return (
    <View style={{ gap: spacing.md }}>
      {current.map((due) => (
        <DueCard key={due.id} due={due} showLot={!single} action={single ? seeMine : undefined} />
      ))}
      {!single && seeMine}
    </View>
  );
}
