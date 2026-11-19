// Écran 2 de docs/accordeons.png : « Impayés » du syndic, regroupés par bâtiment. Le premier bâtiment
// qui a des impayés est ouvert ; les autres sont fermés avec leur résumé exact (nombre d'impayés et
// reste à payer). Les lots d'un bâtiment ne sont chargés qu'à l'ouverture de sa section.
// « Relancer tous les impayés (N) » (avec confirmation) reste au-dessus ; « Relancer » par lot.
// Un lot relancé il y a moins de 3 jours affiche « Relancé » (désactivé) avec la date de la prochaine
// relance possible. Seuls les copropriétaires du lot reçoivent le rappel (texte générique).
import { can, formatMad } from '@syndic/shared';
import {
  Accordion,
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
import Building from 'lucide-react-native/icons/building';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SectionError, SectionLoading } from '@/components/section-parts';
import { AuthHeader } from '@/features/auth/auth-header';
import {
  useSendReminders,
  useUnpaidBuildings,
  useUnpaidDues,
  type DueRow,
  type ReminderInput,
} from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { formatReminderLine, reminderButtonState, reminderToastKey } from '@/lib/reminders';
import { defaultOpenKey, useSectionOpen } from '@/lib/sections';
import { useLanguage } from '@/providers/language-provider';

import { QueryFallback } from './query-fallback';
import { ReferenceBox } from './reference-box';
import { useChargeFormat } from './use-charge-format';

/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

/** Relances : réservées à `charges.write` (syndic), comme l'API. */
export const canRemind = (role: Parameters<typeof can>[0]): boolean =>
  can(role, 'charges.write') && can(role, 'payments.write');

/** Clé d'un bâtiment dans la mémoire des sections : son nom, ou « - » sans bâtiment. */
const buildingKey = (building: string | null): string => building ?? '-';

/** Lots impayés d'un bâtiment, chargés à l'ouverture de sa section. */
function BuildingDues({
  residenceId,
  callId,
  building,
  now,
  sending,
  busyLot,
  onRemind,
}: {
  residenceId: string;
  callId: string;
  building: string | null;
  now: Date;
  sending: boolean;
  busyLot: string | undefined;
  onRemind: (lotId: string) => void;
}) {
  const { spacing } = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const dues = useUnpaidDues(residenceId, callId, building);

  if (dues.data === undefined) {
    return dues.error ? (
      <SectionError onRetry={() => void dues.refetch()} retrying={dues.isFetching} />
    ) : (
      <SectionLoading />
    );
  }

  const lastLine = (due: DueRow) =>
    due.lastReminderAt && due.nextReminderAt
      ? formatReminderLine(language, due.lastReminderAt, due.nextReminderAt, now)
      : undefined;

  return (
    <View style={{ gap: spacing.md }}>
      {dues.data.dues.map((due) => {
        const state = reminderButtonState(due, now);
        const line = state === 'reminded' ? lastLine(due) : undefined;
        return (
          <Card key={due.id}>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ReferenceBox label={due.lotReference} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
                    <Amount centimes={due.status === 'partial' ? due.remaining : due.amountDue} />
                    {due.status === 'partial' && <Text variant="bodyStrong">{t('charges.unpaid.remaining')}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <StatusBadge status={due.status} />
                  </View>
                </View>
                <Button
                  variant="secondary"
                  label={state === 'reminded' ? t('charges.unpaid.reminded') : t('charges.unpaid.remind')}
                  accessibilityLabel={t(state === 'reminded' ? 'charges.unpaid.remindedLabel' : 'charges.unpaid.remindLabel', {
                    lot: due.lotReference,
                  })}
                  disabled={state === 'reminded'}
                  loading={sending && busyLot === due.lotId}
                  onPress={() => onRemind(due.lotId)}
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
  );
}

export function UnpaidScreen({ callId }: { callId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && canRemind(active.role);
  const residenceId = allowed ? active.id : undefined;
  const summary = useUnpaidBuildings(residenceId, callId);
  const sections = useSectionOpen(residenceId === undefined ? undefined : `unpaid:${residenceId}:${callId}`);
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
  const buildings = summary.data?.buildings ?? [];
  // Lots que « Relancer tous » relancerait : l'API les compte (les lots relancés depuis moins de 3 jours sont exclus).
  const toRemind = buildings.reduce((sum, building) => sum + (building.remindableCount ?? 0), 0);
  const openKey = defaultOpenKey(buildings.map((building) => buildingKey(building.building)));

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/charges" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/charge-call/${callId}`));

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

  let body;
  if (summary.data === undefined) {
    body = <QueryFallback query={summary} message={t('charges.loadError')} />;
  } else if (buildings.length === 0) {
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
        {summary.error && <Banner message={t('charges.loadError')} />}
        {error !== undefined && <Banner message={error} />}
        <Button
          variant="secondary"
          icon={Bell}
          label={t('charges.unpaid.remindAll', { count: toRemind })}
          disabled={toRemind === 0}
          loading={send.isPending && busyLot === undefined}
          onPress={() => setConfirming(true)}
        />
        {buildings.map((building) => {
          const key = buildingKey(building.building);
          const amount = formatMad(building.remaining);
          return (
            <Accordion
              key={key}
              icon={Building}
              title={
                building.building === null
                  ? t('lots.building.none')
                  : t('lots.building.title', { name: building.building })
              }
              subtitle={
                building.unpaidCount === 1
                  ? t('sections.unpaid.summaryOne', { amount })
                  : t('sections.unpaid.summaryMany', { count: building.unpaidCount, amount })
              }
              expanded={sections.isOpen(key, key === openKey)}
              onToggle={() => sections.toggle(key, key === openKey)}>
              {residenceId !== undefined && (
                <BuildingDues
                  residenceId={residenceId}
                  callId={callId}
                  building={building.building}
                  now={now}
                  sending={send.isPending}
                  busyLot={busyLot}
                  onRemind={(lotId) => void run({ lotId }, lotId)}
                />
              )}
            </Accordion>
          );
        })}
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
          {summary.data !== undefined && (
            <Text variant="small" tone="muted">
              {t('charges.unpaid.kicker', { period: format.period(summary.data.periodLabel) })}
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
            <Button label={t('charges.unpaid.confirm', { count: toRemind })} onPress={() => void onConfirmAll()} />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirming(false)} />
          </>
        }>
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
