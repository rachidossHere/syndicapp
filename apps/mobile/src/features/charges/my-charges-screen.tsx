// Écrans 5 et 7 de docs/charges.png : « Mes charges » du copropriétaire. Carte de la période en
// cours (une par appartement), puis l'historique : période, statut et lien vers chaque reçu.
// Uniquement les dus de MES appartements (GET /api/me/dues) ; un autre rôle est renvoyé à l'accueil.
import { Amount, EmptyState, ListItem, Screen, StatusBadge, Text, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Wallet from 'lucide-react-native/icons/wallet';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useMyDues, type MyDue, type MyPayment } from '@/hooks/use-charges';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';

import { MyChargeCard } from './my-charge-card';
import { currentDuePerLot, lotReferences } from './my-charges';
import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

/** Paiements qui ont un reçu, le plus récent en premier. */
const receiptsOf = (due: MyDue): (MyPayment & { receiptId: string })[] =>
  due.payments
    .filter((payment): payment is MyPayment & { receiptId: string } => payment.receiptId !== null)
    .reverse();

export function MyChargesScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const isOwner = active !== null && active.role === 'owner';
  const dues = useMyDues(isOwner ? active.id : undefined);
  useRefreshOnFocus(dues.refetch);

  if (residencesQuery.data !== undefined && !isOwner) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openReceipt = (receiptId: string) => router.push({ pathname: '/receipt/[id]', params: { id: receiptId } });
  const severalLots = dues.data !== undefined && new Set(dues.data.map((due) => due.lotReference)).size > 1;

  const subtitle = (due: MyDue) => {
    if (due.status === 'paid') {
      const last = due.payments.filter((payment) => payment.cancelledAt === null).at(-1);
      return last ? t('mine.rowPaid', { date: format.instant(last.paidAt) }) : t('charges.status.paid');
    }
    if (due.status === 'partial') return t('mine.rowPartial', { date: format.date(due.dueDate) });
    return t('charges.list.dueOn', { date: format.date(due.dueDate) });
  };

  const renderDue = (due: MyDue) => {
    const receipts = receiptsOf(due);
    const title = severalLots
      ? `${format.period(due.periodLabel)} · ${t('mine.lot', { lot: due.lotReference })}`
      : format.period(due.periodLabel);
    return (
      <View key={due.id} style={{ gap: spacing.sm }}>
        <ListItem
          leading={<ReferenceBox label={format.shortPeriod(due.periodLabel)} />}
          title={title}
          subtitle={subtitle(due)}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
              <Amount centimes={due.amountDue} variant="small" />
              <StatusBadge status={due.status} />
            </View>
          }
          // Un seul reçu : la ligne l'ouvre. Plusieurs (paiements partiels) : un lien par reçu.
          onPress={receipts.length === 1 ? () => openReceipt(receipts[0]!.receiptId) : undefined}
        />
        {receipts.length > 1 &&
          receipts.map((payment) => (
            <ListItem
              key={payment.id}
              title={t('charges.payment.receipt', { number: payment.receiptNumber ?? '' })}
              subtitle={t('charges.payment.line', {
                method: format.method(payment.method),
                date: format.instant(payment.paidAt),
              })}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Amount centimes={payment.amount} variant="small" />
                  {payment.cancelledAt !== null && <StatusBadge status="cancelled" />}
                </View>
              }
              onPress={() => openReceipt(payment.receiptId)}
            />
          ))}
      </View>
    );
  };

  let body;
  if (dues.data === undefined) {
    body = <QueryFallback query={dues} message={t('mine.loadError')} />;
  } else if (dues.data.length === 0) {
    body = <EmptyState icon={Wallet} title={t('mine.emptyTitle')} description={t('mine.emptyBody')} />;
  } else {
    const current = currentDuePerLot(dues.data);
    body = (
      <>
        {current.map((due) => (
          <MyChargeCard key={due.id} due={due} showLot={current.length > 1} />
        ))}
        <View style={{ gap: spacing.md }}>
          <Text variant="h3">{t('mine.history')}</Text>
          {dues.data.map(renderDue)}
        </View>
      </>
    );
  }

  return (
    <Screen
      scroll
      onRefresh={() => void dues.refetch()}
      refreshing={dues.isRefetching}
      footer={
        <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
          {t('mine.note')}
        </Text>
      }>
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        {active !== null && dues.data !== undefined && dues.data.length > 0 && (
          <Text variant="small" tone="muted">
            {t('mine.context', { name: active.name, lots: lotReferences(dues.data) })}
          </Text>
        )}
        <Text variant="h2">{t('mine.title')}</Text>
      </View>
      {body}
    </Screen>
  );
}
