// Écran 6 de docs/annonces.png : « Impayés » du syndic. Un appel de charges, les lots impayés ou
// partiels, « Relancer tous les impayés (N) » (avec confirmation) et « Relancer » par lot.
// Un lot relancé il y a moins de 3 jours affiche « Relancé » (désactivé) avec la date de la prochaine
// relance possible. Seuls les copropriétaires du lot reçoivent le rappel (texte générique).
import { can } from '@syndic/shared';
import {
  Amount,
  Banner,
  Button,
  Card,
  EmptyState,
  Screen,
  Sheet,
  StatusBadge,
  Text,
  Toast,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import {
  useChargeCall,
  useSendReminders,
  type DueRow,
  type ReminderInput,
} from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { useLanguage } from '@/providers/language-provider';
import { apiErrorKey } from '@/lib/api-errors';
import {
  formatReminderLine,
  isUnpaid,
  reminderButtonState,
  reminderToastKey,
  remindableCount,
} from '@/lib/reminders';

import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

/** Relances : réservées à `charges.write` (syndic), comme l'API. */
export const canRemind = (role: Parameters<typeof can>[0]): boolean =>
  can(role, 'charges.write') && can(role, 'payments.write');

export function UnpaidScreen({ callId }: { callId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && canRemind(active.role);
  const residenceId = allowed ? active.id : undefined;
  const call = useChargeCall(residenceId, callId);
  const send = useSendReminders(residenceId);
  const [toast, setToast] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyLot, setBusyLot] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const now = new Date();
  const unpaid = useMemo(() => (call.data?.dues ?? []).filter(isUnpaid), [call.data]);
  const toRemind = remindableCount(unpaid, now);

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/charges" />;

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace(`/charge-call/${callId}`);

  const run = async (input: ReminderInput, lotId?: string) => {
    if (send.isPending) return;
    setError(undefined);
    setBusyLot(lotId);
    try {
      const result = await send.mutateAsync(input);
      const kind = reminderToastKey(result.reminded);
      setToast(
        kind === 'none'
          ? t('charges.unpaid.toastNone')
          : kind === 'one'
            ? t('charges.unpaid.toastOne')
            : t('charges.unpaid.toastMany', { count: result.reminded }),
      );
    } catch (caught) {
      setError(t(apiErrorKey(caught)));
    } finally {
      setBusyLot(undefined);
    }
  };

  const onConfirmAll = async () => {
    setConfirming(false);
    await run({ all: true, chargeCallId: callId });
  };

  const lastLine = (due: DueRow) =>
    due.lastReminderAt && due.nextReminderAt
      ? formatReminderLine(language, due.lastReminderAt, due.nextReminderAt, now)
      : undefined;

  let body;
  if (call.data === undefined) {
    body = <QueryFallback query={call} message={t('charges.loadError')} />;
  } else if (unpaid.length === 0) {
    body = (
      <EmptyState
        domain="charges"
        title={t('charges.unpaid.emptyTitle')}
        description={t('charges.unpaid.emptyBody')}
        action={<Button variant="secondary" label={t('common.back')} onPress={goBack} />}
      />
    );
  } else {
    body = (
      <>
        {call.error && <Banner message={t('charges.loadError')} />}
        {error !== undefined && <Banner message={error} />}
        <Button
          variant="secondary"
          icon={Bell}
          label={t('charges.unpaid.remindAll', { count: toRemind })}
          disabled={toRemind === 0}
          loading={send.isPending && busyLot === undefined}
          onPress={() => setConfirming(true)}
        />
        <View style={{ gap: spacing.md }}>
          {unpaid.map((due) => {
            const state = reminderButtonState(due, now);
            const line = state === 'reminded' ? lastLine(due) : undefined;
            return (
              <Card key={due.id}>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <ReferenceBox label={due.lotReference} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: spacing.xs,
                        }}
                      >
                        <Amount
                          centimes={due.status === 'partial' ? due.remaining : due.amountDue}
                        />
                        {due.status === 'partial' && (
                          <Text variant="bodyStrong">{t('charges.unpaid.remaining')}</Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        <StatusBadge status={due.status} />
                      </View>
                    </View>
                    <Button
                      variant="secondary"
                      label={
                        state === 'reminded'
                          ? t('charges.unpaid.reminded')
                          : t('charges.unpaid.remind')
                      }
                      accessibilityLabel={t(
                        state === 'reminded'
                          ? 'charges.unpaid.remindedLabel'
                          : 'charges.unpaid.remindLabel',
                        { lot: due.lotReference },
                      )}
                      disabled={state === 'reminded'}
                      loading={send.isPending && busyLot === due.lotId}
                      onPress={() => void run({ lotId: due.lotId }, due.lotId)}
                    />
                  </View>
                  {line !== undefined && (
                    <Text variant="small" tone="muted">
                      {line}
                    </Text>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
        <Text variant="small" tone="muted">
          {t('charges.unpaid.note')}
        </Text>
      </>
    );
  }

  return (
    <>
      <Screen scroll footer={toast !== undefined ? <Toast message={toast} /> : undefined}>
        <AuthHeader onBack={goBack} />
        <View style={{ gap: spacing.xs }}>
          {call.data !== undefined && (
            <Text variant="small" tone="muted">
              {t('charges.unpaid.kicker', { period: format.period(call.data.periodLabel) })}
            </Text>
          )}
          <Text variant="h1">{t('charges.unpaid.title')}</Text>
        </View>
        {body}
      </Screen>
      <Sheet
        visible={confirming}
        title={t('charges.unpaid.confirmTitle')}
        dismissLabel={t('common.closeSheet')}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button
              label={t('charges.unpaid.confirm', { count: toRemind })}
              onPress={() => void onConfirmAll()}
            />
            <Button
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setConfirming(false)}
            />
          </>
        }
      >
        <Text>
          {t(toRemind === 1 ? 'charges.unpaid.confirmBodyOne' : 'charges.unpaid.confirmBodyMany', {
            count: toRemind,
          })}
        </Text>
        <Text variant="small" tone="muted">
          {t('charges.unpaid.note')}
        </Text>
      </Sheet>
    </>
  );
}
