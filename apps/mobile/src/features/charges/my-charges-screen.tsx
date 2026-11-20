// Écran 3 de docs/accordeons.png : « Mes charges » du copropriétaire. La carte de la période en cours
// reste au-dessus (une par appartement), puis l'historique par année : l'année en cours est ouverte, les
// autres fermées avec « N payés sur M » et le total payé. Les dus d'une année ne sont chargés qu'à
// l'ouverture de sa section ; chaque ligne payée ouvre son reçu.
// Uniquement les dus de MES appartements (GET /api/me/dues) ; un autre rôle est renvoyé à l'accueil.
import {
  Accordion,
  Amount,
  EmptyState,
  ListItem,
  Screen,
  StatusBadge,
  Text,
  useTheme,
} from '@syndic/ui';
import { formatMad } from '@syndic/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import Wallet from 'lucide-react-native/icons/wallet';
import { useCallback } from 'react';
import { View } from 'react-native';

import { SectionError, SectionLoading } from '@/components/section-parts';
import {
  chargesQueryKey,
  useMyDueYears,
  useMyDuesOfYear,
  type MyDue,
  type MyPayment,
} from '@/hooks/use-charges';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { currentYearKey, defaultOpenKey, useSectionOpen } from '@/lib/sections';

import { myDuesResidenceId } from './access';
import { MyChargeCard } from './my-charge-card';
import { currentDuePerLot, lastActivePayment, lotReferences } from './my-charges';
import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

/** Paiements qui ont un reçu, le plus récent en premier. */
const receiptsOf = (due: MyDue): (MyPayment & { receiptId: string })[] =>
  due.payments.filter((payment): payment is MyPayment & { receiptId: string } => payment.receiptId !== null).reverse();

/** Mes dus d'une année, chargés à l'ouverture de sa section : une ligne par appel, avec le lien vers le reçu. */
function YearDues({ residenceId, year }: { residenceId: string; year: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const dues = useMyDuesOfYear(residenceId, year);

  if (dues.data === undefined) {
    return dues.error ? (
      <SectionError onRetry={() => void dues.refetch()} retrying={dues.isFetching} />
    ) : (
      <SectionLoading />
    );
  }

  const openReceipt = (receiptId: string) => router.push({ pathname: '/receipt/[id]', params: { id: receiptId } });
  const severalLots = new Set(dues.data.map((due) => due.lotReference)).size > 1;

  const subtitle = (due: MyDue) => {
    if (due.status === 'paid') {
      const last = lastActivePayment(due);
      return last ? t('mine.rowPaid', { date: format.instant(last.paidAt) }) : t('charges.status.paid');
    }
    if (due.status === 'partial') return t('mine.rowPartial', { date: format.date(due.dueDate) });
    return t('charges.list.dueOn', { date: format.date(due.dueDate) });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {dues.data.map((due) => {
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
      })}
    </View>
  );
}

export function MyChargesScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const queryClient = useQueryClient();
  const { active, query: residencesQuery } = useActiveResidence();
  const isOwner = active !== null && active.role === 'owner';
  const residenceId = myDuesResidenceId(active);
  const years = useMyDueYears(residenceId);
  const yearKeys = years.data?.map((summary) => summary.year) ?? [];
  const openKey = defaultOpenKey(yearKeys, currentYearKey());
  // La carte du mois en cours vient des dus de l'année la plus récente : seule année chargée sans ouverture.
  const latest = useMyDuesOfYear(years.data !== undefined && yearKeys.length > 0 ? residenceId : undefined, yearKeys[0] ?? 'none');
  const sections = useSectionOpen(residenceId === undefined ? undefined : `mine:${residenceId}`);
  const refreshAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
    [queryClient, residenceId],
  );
  useRefreshOnFocus(refreshAll);

  if (residencesQuery.data !== undefined && !isOwner) return <Redirect href="/home" />;

  let body;
  if (years.data === undefined) {
    body = <QueryFallback query={years} message={t('mine.loadError')} />;
  } else if (years.data.length === 0) {
    body = <EmptyState domain="charges" title={t('mine.emptyTitle')} description={t('mine.emptyBody')} />;
  } else {
    const current = latest.data === undefined ? [] : currentDuePerLot(latest.data);
    body = (
      <>
        {current.map((due) => (
          <MyChargeCard key={due.id} due={due} showLot={current.length > 1} />
        ))}
        <Text variant="h3">{t('mine.history')}</Text>
        {years.data.map((summary) => {
          const total = formatMad(summary.totalPaid);
          return (
            <Accordion
              key={summary.year}
              icon={Wallet}
              title={summary.year}
              subtitle={t(summary.paidCount <= 1 ? 'sections.mine.paidOfOne' : 'sections.mine.paidOfMany', {
                paid: summary.paidCount,
                total: summary.dueCount,
              })}
              trailing={<Amount centimes={summary.totalPaid} variant="small" />}
              trailingLabel={total}
              expanded={sections.isOpen(summary.year, summary.year === openKey)}
              onToggle={() => sections.toggle(summary.year, summary.year === openKey)}>
              {residenceId !== undefined && <YearDues residenceId={residenceId} year={summary.year} />}
            </Accordion>
          );
        })}
      </>
    );
  }

  return (
    <Screen
      scroll
      onRefresh={() => void refreshAll()}
      refreshing={years.isRefetching}
      footer={
        <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
          {t('mine.note')}
        </Text>
      }>
      <View style={{ gap: spacing.xs }}>
        {active !== null && latest.data !== undefined && latest.data.length > 0 && (
          <Text variant="small" tone="muted">
            {t('mine.context', { name: active.name, lots: lotReferences(latest.data) })}
          </Text>
        )}
        <Text variant="h2">{t('mine.title')}</Text>
      </View>
      {body}
    </Screen>
  );
}
