// Écran 1 de docs/charges.png : appel en cours (encaissé, progression, payés / partiels / impayés,
// reste, échéance) et appels précédents. Réservé au syndic et au trésorier.
import { can, formatMad, type Role } from '@syndic/shared';
import {
  Amount,
  Banner,
  Button,
  Card,
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
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Banknote from 'lucide-react-native/icons/banknote';
import Plus from 'lucide-react-native/icons/plus';
import Wallet from 'lucide-react-native/icons/wallet';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useRoleLabel } from '@/features/residences/use-role-label';
import { useChargeCalls, type ChargeCallSummary } from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';

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

function CountsLine({ call }: { call: ChargeCallSummary }) {
  const t = useT();
  const { spacing } = useTheme();
  const part = (count: number, one: 'paidOne' | 'partialOne' | 'unpaidOne', many: 'paidMany' | 'partialMany' | 'unpaidMany') =>
    t(count === 1 ? `charges.list.${one}` : `charges.list.${many}`, { count });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.xs }}>
      <Text variant="small" tone="muted">
        {[
          part(call.paidCount, 'paidOne', 'paidMany'),
          part(call.partialCount, 'partialOne', 'partialMany'),
          part(call.unpaidCount, 'unpaidOne', 'unpaidMany'),
        ].join(' · ')}
        {` · ${t('charges.list.outOf')}`}
      </Text>
      <Amount centimes={call.totalDue} variant="small" tone="muted" />
    </View>
  );
}

function CurrentCallCard({ call, onPress }: { call: ChargeCallSummary; onPress: () => void }) {
  const t = useT();
  const format = useChargeFormat();
  const { spacing } = useTheme();
  const progress = call.totalDue === 0 ? 0 : call.totalPaid / call.totalDue;
  return (
    <Card onPress={onPress} accessibilityLabel={format.period(call.periodLabel)} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="h3" style={{ flex: 1 }}>
          {format.period(call.periodLabel)}
        </Text>
        <StatusBadge status={callStatus(call, true)} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md }}>
        <Text tone="muted">{t('charges.list.collected')}</Text>
        <Amount centimes={call.totalPaid} variant="h2" tone="success" />
      </View>
      <ProgressBar
        value={progress}
        accessibilityLabel={t('charges.list.progress', {
          paid: formatMad(call.totalPaid),
          total: formatMad(call.totalDue),
        })}
      />
      <CountsLine call={call} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="small" tone="danger">
            {t('charges.list.remaining')}
          </Text>
          <Amount centimes={call.remaining} variant="small" tone="danger" />
        </View>
        <Text variant="small" tone="muted">
          {t('charges.list.dueOn', { date: format.date(call.dueDate) })}
        </Text>
      </View>
    </Card>
  );
}

export function ChargesScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const roleLabel = useRoleLabel();
  const format = useChargeFormat();
  const { created } = useLocalSearchParams<{ created?: string }>();
  const { active, query: residencesQuery } = useActiveResidence();
  const role: Role | undefined = active?.role;
  const allowed = role !== undefined && canManageCharges(role);
  const calls = useChargeCalls(allowed ? active?.id : undefined);
  const [toast, setToast] = useState<string | undefined>(created === '1' ? t('charges.new.created') : undefined);

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const canCreate = role !== undefined && can(role, 'charges.write');
  const canCollect = role !== undefined && can(role, 'payments.write');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openCall = (id: string) => router.push({ pathname: '/charge-call/[id]', params: { id } });
  const current = calls.data?.[0];
  const previous = calls.data?.slice(1) ?? [];

  let body;
  if (calls.data === undefined) {
    body = <QueryFallback query={calls} message={t('charges.loadError')} />;
  } else if (current === undefined) {
    body = (
      <EmptyState
        icon={Wallet}
        title={t('charges.list.emptyTitle')}
        description={t(canCreate ? 'charges.list.emptyManager' : 'charges.list.emptyTreasurer')}
      />
    );
  } else {
    body = (
      <>
        {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
        {calls.error && <Banner message={t('charges.loadError')} />}
        <CurrentCallCard call={current} onPress={() => openCall(current.id)} />
        {previous.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <Text variant="h3">{t('charges.list.previous')}</Text>
            {previous.map((call) => (
              <ListItem
                key={call.id}
                leading={<ReferenceBox label={format.shortPeriod(call.periodLabel)} />}
                title={format.period(call.periodLabel)}
                subtitle={
                  call.unpaidCount > 0
                    ? t(call.unpaidCount === 1 ? 'charges.list.unpaidOne' : 'charges.list.unpaidMany', {
                        count: call.unpaidCount,
                      })
                    : t('charges.list.dueOn', { date: format.date(call.dueDate) })
                }
                trailing={
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    <Amount centimes={call.totalDue} variant="small" />
                    <StatusBadge status={callStatus(call, false)} />
                  </View>
                }
                onPress={() => openCall(call.id)}
              />
            ))}
          </View>
        )}
      </>
    );
  }

  const footer =
    calls.data !== undefined && (canCollect || canCreate) ? (
      <>
        {canCollect && current !== undefined && (
          <Button
            icon={Banknote}
            label={t('charges.list.collect')}
            onPress={() => router.push({ pathname: '/collect', params: { callId: current.id } })}
          />
        )}
        {canCreate && (
          <Button
            variant={current !== undefined && canCollect ? 'secondary' : 'primary'}
            icon={Plus}
            label={t('charges.list.newCall')}
            onPress={() => router.push('/new-charge-call')}
          />
        )}
      </>
    ) : undefined;

  return (
    <Screen scroll footer={footer}>
      {toast !== undefined && <Toast message={toast} />}
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {t('charges.list.context', { name: active.name, role: roleLabel(active.role, { lower: true }) })}
          </Text>
        )}
        <Text variant="h2">{t('charges.list.title')}</Text>
      </View>
      {body}
    </Screen>
  );
}
