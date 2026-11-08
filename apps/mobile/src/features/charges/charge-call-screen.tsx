// Écran 3 de docs/charges.png : détail d'un appel, un élément par appartement (référence, état,
// montant, reçu), avec les filtres Tous / Impayés / Partiels / Payés.
// Toucher un appartement qui a des paiements les affiche : ouvrir le reçu PDF, annuler avec motif.
// Toucher un appartement sans paiement ouvre « Encaisser » sur cet appartement.
import { can, type DueStatus } from '@syndic/shared';
import {
  Amount,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  StatusBadge,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Banknote from 'lucide-react-native/icons/banknote';
import FileText from 'lucide-react-native/icons/file-text';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import {
  useCancelPayment,
  useChargeCall,
  useOpenReceipt,
  type DuePayment,
  type DueRow,
} from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';

import { canManageCharges } from './access';
import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

type Filter = 'all' | DueStatus;
const FILTERS: readonly Filter[] = ['all', 'unpaid', 'partial', 'paid'];
const FILTER_KEYS = {
  all: 'charges.detail.filterAll',
  unpaid: 'charges.detail.filterUnpaid',
  partial: 'charges.detail.filterPartial',
  paid: 'charges.detail.filterPaid',
} as const;
/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

/** Dernier paiement non annulé (date et reçu affichés sur la ligne d'un appartement payé). */
const lastValidPayment = (due: DueRow) =>
  [...due.payments].reverse().find((p) => p.cancelledAt === null);

function DueSummary({ due, canCollect }: { due: DueRow; canCollect: boolean }) {
  const t = useT();
  const format = useChargeFormat();
  const { spacing } = useTheme();
  if (due.status === 'paid') {
    const payment = lastValidPayment(due);
    return (
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">
          {payment
            ? t('charges.detail.paidOn', { date: format.instant(payment.paidAt) })
            : t('charges.status.paid')}
        </Text>
        {payment !== undefined && (
          <Text variant="small" tone="muted">
            {t('charges.detail.paidDetail', {
              method: format.method(payment.method),
              number: payment.receiptNumber ?? '—',
            })}
          </Text>
        )}
      </View>
    );
  }
  if (due.status === 'partial') {
    return (
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}
        >
          <Amount centimes={due.amountPaid} />
          <Text variant="bodyStrong">{t('charges.detail.received')}</Text>
        </View>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}
        >
          <Text variant="small" tone="muted">
            {t('charges.detail.remaining')}
          </Text>
          <Amount centimes={due.remaining} variant="small" tone="muted" />
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text variant="bodyStrong">{t('charges.detail.nothing')}</Text>
      {canCollect && (
        <Text variant="small" tone="muted">
          {t('charges.detail.nothingHint')}
        </Text>
      )}
    </View>
  );
}

function PaymentRow({
  payment,
  first,
  canCancel,
  residenceId,
  onCancelled,
}: {
  payment: DuePayment;
  first: boolean;
  canCancel: boolean;
  residenceId: string | undefined;
  onCancelled: () => void;
}) {
  const t = useT();
  const format = useChargeFormat();
  const { colors, spacing, borderWidth } = useTheme();
  const openReceipt = useOpenReceipt();
  const cancel = useCancelPayment(residenceId);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const cancelled = payment.cancelledAt !== null;

  const onOpen = async () => {
    if (payment.receiptId === null || openReceipt.isPending) return;
    setError(undefined);
    try {
      await openReceipt.mutateAsync(payment.receiptId);
    } catch (caught) {
      setError(t(apiErrorKey(caught)));
    }
  };

  const onConfirmCancel = async () => {
    if (cancel.isPending) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError(t('charges.errors.cancelReasonRequired'));
      return;
    }
    setError(undefined);
    try {
      await cancel.mutateAsync({ paymentId: payment.id, reason: trimmed });
      setCancelling(false);
      setReason('');
      onCancelled();
    } catch (caught) {
      // Le motif saisi est conservé pour réessayer.
      setError(t(apiErrorKey(caught)));
    }
  };

  return (
    <View
      style={[
        { gap: spacing.sm },
        // Séparateur entre deux paiements d'un même appartement.
        !first && {
          paddingTop: spacing.md,
          borderTopWidth: borderWidth.thin,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}
      >
        <Amount centimes={payment.amount} tone={cancelled ? 'muted' : 'default'} />
        <Text tone="muted">
          {t('charges.payment.line', {
            method: format.method(payment.method),
            date: format.instant(payment.paidAt),
          })}
        </Text>
      </View>
      {payment.receiptNumber !== null && (
        <Text variant="small" tone="muted" selectable>
          {t('charges.payment.receipt', { number: payment.receiptNumber })}
        </Text>
      )}
      {cancelled && (
        <Text variant="small" tone="danger">
          {t('charges.payment.cancelledOn', {
            date: format.instant(payment.cancelledAt ?? payment.paidAt),
            reason: payment.cancelReason ?? '',
          })}
        </Text>
      )}
      {payment.receiptId !== null && (
        <Button
          variant="secondary"
          icon={FileText}
          label={t('charges.payment.openReceipt')}
          loading={openReceipt.isPending}
          onPress={() => void onOpen()}
        />
      )}
      {canCancel && !cancelled && !cancelling && (
        <Button
          variant="ghost"
          label={t('charges.payment.cancel')}
          onPress={() => setCancelling(true)}
        />
      )}
      {cancelling && (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label={t('charges.payment.reason')}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              setReasonError(undefined);
            }}
            maxLength={500}
            helper={t('charges.payment.reasonHelp')}
            error={reasonError}
          />
          <Button
            label={t('charges.payment.confirmCancel')}
            loading={cancel.isPending}
            onPress={() => void onConfirmCancel()}
          />
          <Button
            variant="ghost"
            label={t('charges.payment.keep')}
            onPress={() => {
              setCancelling(false);
              setReasonError(undefined);
            }}
          />
        </View>
      )}
      {error !== undefined && <Banner message={error} />}
    </View>
  );
}

export function ChargeCallScreen({ callId }: { callId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  // Détail par appartement : réservé aux encaisseurs (payments.write), comme l'API.
  const allowed =
    active !== null && canManageCharges(active.role) && can(active.role, 'payments.write');
  const residenceId = allowed ? active.id : undefined;
  const call = useChargeCall(residenceId, callId);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, unpaid: 0, partial: 0, paid: 0 };
    for (const due of call.data?.dues ?? []) {
      result.all += 1;
      result[due.status] += 1;
    }
    return result;
  }, [call.data]);

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/charges" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/charges'));
  const collect = (dueId?: string) =>
    router.push({ pathname: '/collect', params: dueId ? { callId, dueId } : { callId } });
  const visible = (call.data?.dues ?? []).filter(
    (due) => filter === 'all' || due.status === filter,
  );

  const onDuePress = (due: DueRow) => {
    if (due.payments.length === 0) {
      collect(due.id);
      return;
    }
    setExpanded((current) => (current === due.id ? undefined : due.id));
  };

  let body;
  if (call.data === undefined) {
    body = <QueryFallback query={call} message={t('charges.loadError')} />;
  } else {
    body = (
      <>
        {call.error && <Banner message={t('charges.loadError')} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FILTERS.map((value) => (
            <Chip
              key={value}
              label={t(FILTER_KEYS[value], { count: counts[value] })}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </View>
        {visible.length === 0 ? (
          <EmptyState
            title={t('charges.detail.noResultsTitle')}
            description={t('charges.detail.noResultsBody')}
            action={
              <Button
                variant="secondary"
                label={t('charges.detail.showAll')}
                onPress={() => setFilter('all')}
              />
            }
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {visible.map((due) => (
              <View key={due.id} style={{ gap: spacing.sm }}>
                <Card
                  onPress={() => onDuePress(due)}
                  accessibilityLabel={t('charges.detail.rowLabel', {
                    lot: due.lotReference,
                    status: t(`charges.status.${due.status}`),
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <ReferenceBox label={due.lotReference} />
                    <DueSummary due={due} canCollect={due.payments.length === 0} />
                    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                      <Amount centimes={due.amountDue} variant="small" />
                      <StatusBadge status={due.status} />
                    </View>
                  </View>
                </Card>
                {/* Paiements hors de la carte appuyable : chaque bouton reste atteignable au lecteur d'écran. */}
                {expanded === due.id && (
                  <Card>
                    {due.payments.map((payment, index) => (
                      <PaymentRow
                        key={payment.id}
                        payment={payment}
                        first={index === 0}
                        canCancel
                        residenceId={residenceId}
                        onCancelled={() => setToast(t('charges.payment.cancelled'))}
                      />
                    ))}
                  </Card>
                )}
              </View>
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <Screen
      scroll
      footer={
        call.data !== undefined ? (
          <Button icon={Banknote} label={t('charges.detail.collect')} onPress={() => collect()} />
        ) : undefined
      }
    >
      {toast !== undefined && <Toast message={toast} />}
      <AuthHeader onBack={goBack} />
      {call.data !== undefined && (
        <View style={{ gap: spacing.xs }}>
          <Text variant="h2">{format.period(call.data.periodLabel)}</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Amount centimes={call.data.amountPerLot} variant="small" tone="muted" />
            <Text variant="small" tone="muted">
              {t('charges.detail.perLotDue', { date: format.date(call.data.dueDate) })}
            </Text>
          </View>
        </View>
      )}
      {body}
    </Screen>
  );
}
