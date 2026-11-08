// Écran 2 de docs/charges.png : nouvel appel de charges (période selon le réglage de la résidence,
// montant par appartement, échéance), avec l'aperçu « 48 appartements × 450 MAD = 21 600 MAD ».
import { can } from '@syndic/shared';
import { Amount, Banner, Button, Chip, EmptyState, Screen, Text, TextField, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useChargeCalls, useCreateChargeCall, useCurrentResidence } from '@/hooks/use-charges';
import { useLots } from '@/hooks/use-lots';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { defaultDueDate, parseMadInput, todayCasablanca, upcomingPeriods } from '@/lib/charges-format';

import { DateField } from './date-field';
import { QueryFallback } from './query-fallback';
import { useChargeFormat } from './use-charge-format';

/** Périodes proposées : la période en cours et les suivantes, sans celles déjà lancées. */
const PROPOSED_PERIODS = 4;

export function NewChargeCallScreen() {
  const { colors, radius, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'charges.write');
  const residenceId = allowed ? active.id : undefined;
  const residence = useCurrentResidence(residenceId);
  const calls = useChargeCalls(residenceId);
  const lots = useLots(residenceId);
  const create = useCreateChargeCall(residenceId);

  const today = useMemo(() => todayCasablanca(), []);
  const periods = useMemo(() => {
    if (residence.data === undefined || calls.data === undefined) return [];
    const taken = new Set(calls.data.map((call) => call.periodLabel));
    return upcomingPeriods(residence.data.chargePeriod, today, PROPOSED_PERIODS + taken.size)
      .filter((label) => !taken.has(label))
      .slice(0, PROPOSED_PERIODS);
  }, [residence.data, calls.data, today]);

  const [chosenPeriod, setChosenPeriod] = useState<string | undefined>();
  const periodLabel = chosenPeriod ?? periods[0];
  const [amountText, setAmountText] = useState('');
  const [chosenDueDate, setChosenDueDate] = useState<string | undefined>();
  const dueDate = chosenDueDate ?? (periodLabel === undefined ? today : defaultDueDate(periodLabel, today));
  const [showAmountError, setShowAmountError] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/charges" />;

  const amount = parseMadInput(amountText);
  const lotCount = lots.data?.length ?? 0;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/charges'));

  const choosePeriod = (label: string) => {
    setChosenPeriod(label);
    // L'échéance suit la période tant qu'elle n'a pas été choisie à la main.
    setChosenDueDate(undefined);
  };

  const onSubmit = async () => {
    if (create.isPending || periodLabel === undefined) return;
    if (amount === undefined) {
      setShowAmountError(true);
      return;
    }
    setError(undefined);
    try {
      await create.mutateAsync({ periodLabel, amountPerLot: amount, dueDate });
      router.replace({ pathname: '/charges', params: { created: '1' } });
    } catch (caught) {
      // Le brouillon reste affiché : 409 « Cet appel de charges existe déjà », réseau, etc.
      setError(t(apiErrorKey(caught)));
    }
  };

  const loading = [residence, calls, lots].find((query) => query.data === undefined);

  let body;
  if (loading !== undefined) {
    body = <QueryFallback query={loading} message={t('common.loadError')} />;
  } else if (lotCount === 0) {
    body = (
      <EmptyState
        icon={Building}
        title={t('charges.new.noLotsTitle')}
        description={t('charges.new.noLotsBody')}
        action={<Button label={t('charges.new.addLots')} onPress={() => router.push('/add-lots')} />}
      />
    );
  } else {
    body = (
      <>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('charges.new.period')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {periods.map((label) => (
              <Chip
                key={label}
                label={format.period(label)}
                selected={label === periodLabel}
                onPress={() => choosePeriod(label)}
              />
            ))}
          </View>
          <Text variant="small" tone="muted">
            {t(
              residence.data?.chargePeriod === 'monthly'
                ? 'charges.new.periodHelpMonthly'
                : 'charges.new.periodHelpQuarterly',
            )}
          </Text>
        </View>

        <TextField
          label={t('charges.new.amount')}
          value={amountText}
          onChangeText={(text) => {
            setAmountText(text);
            setShowAmountError(false);
          }}
          keyboardType="decimal-pad"
          ltr
          helper={t('charges.new.amountHelp')}
          error={showAmountError ? t('charges.amountInvalid') : undefined}
        />

        <DateField
          label={t('charges.new.dueDate')}
          value={dueDate}
          display={format.date(dueDate, 'long')}
          minimum={today}
          helper={t('charges.new.dueDateHelp')}
          onChange={setChosenDueDate}
        />

        {amount !== undefined && (
          <View
            accessible
            style={{
              gap: spacing.xs,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: colors.primarySoft,
            }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="small" tone="primary">
                {t(lotCount === 1 ? 'charges.new.lotsOne' : 'charges.new.lotsMany', { count: lotCount })}
              </Text>
              <Amount centimes={amount} variant="small" tone="primary" />
            </View>
            <Amount centimes={amount * lotCount} variant="h1" tone="primary" />
            <Text variant="small" tone="primary">
              {t('charges.new.previewNote')}
            </Text>
          </View>
        )}

        {error !== undefined && <Banner message={error} />}
      </>
    );
  }

  return (
    <Screen
      scroll
      footer={
        loading === undefined && lotCount > 0 ? (
          <Button
            label={t('charges.new.submit')}
            loading={create.isPending}
            disabled={periodLabel === undefined}
            onPress={() => void onSubmit()}
          />
        ) : undefined
      }>
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('charges.new.title')}</Text>
      {body}
    </Screen>
  );
}
