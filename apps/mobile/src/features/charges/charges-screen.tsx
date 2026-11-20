// Écran 1 de docs/accordeons.png : « Charges » du syndic et du trésorier, regroupé par année. L'année en
// cours est ouverte, les autres fermées avec leur résumé exact (nombre d'appels, % encaissé, « N impayés »
// ou « Soldé »). Les appels d'une année ne sont chargés qu'à l'ouverture de sa section.
// Réservé au syndic et au trésorier.
import { can, formatMad, type Role } from '@syndic/shared';
import {
  Accordion,
  Amount,
  Badge,
  Banner,
  Button,
  EmptyState,
  ListItem,
  ProgressBar,
  Screen,
  StatusBadge,
  Text,
  Toast,
  useTheme,
  type BusinessStatus,
} from '@syndic/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Banknote from 'lucide-react-native/icons/banknote';
import Plus from 'lucide-react-native/icons/plus';
import Wallet from 'lucide-react-native/icons/wallet';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SectionError, SectionLoading } from '@/components/section-parts';
import { useRoleLabel } from '@/features/residences/use-role-label';
import {
  chargesQueryKey,
  useChargeCallsOfYear,
  useChargeYears,
  type ChargeCallSummary,
} from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { currentYearKey, defaultOpenKey, useSectionOpen } from '@/lib/sections';

import { canManageCharges } from './access';
import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

/** Statut d'un appel : en cours (le plus récent), clôturé (tout encaissé) ou partiel. */
export function callStatus(call: ChargeCallSummary, isCurrent: boolean): BusinessStatus {
  if (call.remaining === 0) return 'closed';
  return isCurrent ? 'ongoing' : 'partial';
}

/** Part encaissée, en pourcentage entier : 0 quand rien n'est dû. */
const percentCollected = (paid: number, due: number): number => (due === 0 ? 0 : Math.round((paid * 100) / due));

/** Un appel : période, montant, « 18 / 24 payés · échéance 30 nov. », barre de progression et statut. */
function CallRow({ call, isLatest, onOpen }: { call: ChargeCallSummary; isLatest: boolean; onOpen: (id: string) => void }) {
  const t = useT();
  const format = useChargeFormat();
  const { spacing } = useTheme();
  const status = callStatus(call, isLatest);
  const progress = call.totalDue === 0 ? 0 : call.totalPaid / call.totalDue;
  return (
    <ListItem
      leading={<ReferenceBox label={format.shortPeriod(call.periodLabel)} />}
      title={format.period(call.periodLabel)}
      subtitle={t('sections.charges.callLine', {
        paid: call.paidCount,
        total: call.lotCount,
        date: format.date(call.dueDate),
      })}
      footer={
        <ProgressBar
          value={progress}
          accessibilityLabel={t('charges.list.progress', {
            paid: formatMad(call.totalPaid),
            total: formatMad(call.totalDue),
          })}
        />
      }
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <Amount centimes={call.totalDue} variant="small" />
          {/* L'appel en cours n'a pas de badge : sa barre de progression et ses compteurs le disent. */}
          {status !== 'ongoing' && <StatusBadge status={status} />}
        </View>
      }
      onPress={() => onOpen(call.id)}
    />
  );
}

/** Contenu d'une année : ses appels, chargés à l'ouverture de la section. */
function YearCalls({
  residenceId,
  year,
  firstYear,
  onOpen,
}: {
  residenceId: string;
  year: string;
  firstYear: boolean;
  onOpen: (id: string) => void;
}) {
  const { spacing } = useTheme();
  const calls = useChargeCallsOfYear(residenceId, year);
  if (calls.data === undefined) {
    return calls.error ? (
      <SectionError onRetry={() => void calls.refetch()} retrying={calls.isFetching} />
    ) : (
      <SectionLoading />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {calls.data.map((call, index) => (
        <CallRow key={call.id} call={call} isLatest={firstYear && index === 0} onOpen={onOpen} />
      ))}
    </View>
  );
}

export function ChargesScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleLabel = useRoleLabel();
  const { created } = useLocalSearchParams<{ created?: string }>();
  const { active, query: residencesQuery } = useActiveResidence();
  const role: Role | undefined = active?.role;
  const allowed = role !== undefined && canManageCharges(role);
  const residenceId = allowed ? active?.id : undefined;
  const years = useChargeYears(residenceId);
  const sections = useSectionOpen(residenceId === undefined ? undefined : `charges:${residenceId}`);
  const [toast, setToast] = useState<string | undefined>();

  // L'écran de création revient ici avec `created=1` : l'onglet est déjà ouvert, le paramètre est consommé.
  useEffect(() => {
    if (created !== '1') return;
    setToast(t('charges.new.created'));
    router.setParams({ created: undefined });
  }, [created, router, t]);

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const canCreate = role !== undefined && can(role, 'charges.write');
  const canCollect = role !== undefined && can(role, 'payments.write');
  const openCall = (id: string) => router.push({ pathname: '/charge-call/[id]', params: { id } });
  const yearKeys = years.data?.map((summary) => summary.year) ?? [];
  const openKey = defaultOpenKey(yearKeys, currentYearKey());

  let body;
  if (years.data === undefined) {
    body = <QueryFallback query={years} message={t('charges.loadError')} />;
  } else if (years.data.length === 0) {
    body = (
      <EmptyState
        domain="charges"
        title={t('charges.list.emptyTitle')}
        description={t(canCreate ? 'charges.list.emptyManager' : 'charges.list.emptyTreasurer')}
      />
    );
  } else {
    body = (
      <>
        {/* Un échec d'actualisation garde les années affichées, avec un message non bloquant. */}
        {years.isRefetchError && <Banner message={t('charges.loadError')} />}
        {years.data.map((summary) => {
          const open = sections.isOpen(summary.year, summary.year === openKey);
          const unpaid = summary.unpaidCount;
          const badgeLabel =
            unpaid === 0
              ? t('sections.charges.settled')
              : t(unpaid === 1 ? 'charges.list.unpaidOne' : 'charges.list.unpaidMany', { count: unpaid });
          return (
            <Accordion
              key={summary.year}
              icon={Wallet}
              title={summary.year}
              subtitle={[
                t(summary.callCount === 1 ? 'sections.charges.callsOne' : 'sections.charges.calls', {
                  count: summary.callCount,
                }),
                t('sections.charges.collectedPct', {
                  percent: percentCollected(summary.totalPaid, summary.totalDue),
                }),
              ].join(' · ')}
              trailing={<Badge tone={unpaid === 0 ? 'success' : 'warning'} label={badgeLabel} />}
              trailingLabel={badgeLabel}
              expanded={open}
              onToggle={() => sections.toggle(summary.year, summary.year === openKey)}>
              {residenceId !== undefined && (
                <YearCalls
                  residenceId={residenceId}
                  year={summary.year}
                  firstYear={summary.year === yearKeys[0]}
                  onOpen={openCall}
                />
              )}
            </Accordion>
          );
        })}
      </>
    );
  }

  return (
    <Screen
      scroll
      onRefresh={() => void queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') })}
      refreshing={years.isRefetching}>
      {toast !== undefined && <Toast message={toast} />}
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {t('charges.list.context', {
              name: active.name,
              role: roleLabel(active.role, { lower: true }),
            })}
          </Text>
        )}
        <Text variant="h2">{t('charges.list.title')}</Text>
      </View>
      {years.data !== undefined && (canCollect || canCreate) && (
        <View style={{ gap: spacing.md }}>
          {canCreate && <Button icon={Plus} label={t('charges.list.newCall')} onPress={() => router.push('/new-charge-call')} />}
          {canCollect && years.data.length > 0 && (
            <Button
              variant={canCreate ? 'secondary' : 'primary'}
              icon={Banknote}
              label={t('charges.list.collect')}
              onPress={() => router.push('/collect')}
            />
          )}
        </View>
      )}
      {body}
    </Screen>
  );
}
