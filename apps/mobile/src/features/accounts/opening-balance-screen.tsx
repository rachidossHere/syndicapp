// Écran 5 de docs/depenses.png : solde de départ (syndic seulement). Première saisie sans motif ;
// toute correction demande un motif et est historisée (ancien et nouveau montant, date, motif).
// L'API refuse de toute façon un autre rôle : l'écran ne fait que le masquer.
import { formatMad } from '@syndic/shared';
import { Amount, Banner, Button, Card, Screen, Text, TextField, Toast, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { DateField } from '@/features/charges/date-field';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import { useOpeningBalance, useSetOpeningBalance, type OpeningBalanceState } from '@/hooks/use-cash';
import { useActiveResidence } from '@/hooks/use-residences';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { openingBalanceResidenceId, validateOpeningBalance, type OpeningFormErrors } from '@/lib/cash';
import { casablancaDate, formatMadInput, todayCasablanca } from '@/lib/charges-format';

/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

function NoticeBox({ title, body }: { title: string; body: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.warningBg,
      }}>
      <Text variant="bodyStrong" style={{ color: colors.warningFg }}>
        {title}
      </Text>
      <Text variant="small" style={{ color: colors.warningFg }}>
        {body}
      </Text>
    </View>
  );
}

function History({ changes }: { changes: OpeningBalanceState['changes'] }) {
  const t = useT();
  const format = useChargeFormat();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="h3">{t('accounts.opening.history')}</Text>
      {changes.map((change) => (
        <Card key={change.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <Amount centimes={change.newAmount} variant="h3" />
            <Text variant="small" tone="muted">
              {change.oldAmount === null
                ? t('accounts.opening.first')
                : t('accounts.opening.previous', { amount: formatMad(change.oldAmount) })}
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {t('accounts.opening.asOf', { date: format.date(change.asOfDate, 'long') })}
          </Text>
          {change.reason !== null && (
            <Text variant="small">{t('accounts.opening.reasonLine', { reason: change.reason })}</Text>
          )}
          <Text variant="caption" tone="muted">
            {t('accounts.opening.changedBy', { date: format.date(casablancaDate(change.changedAt), 'long') })}
          </Text>
        </Card>
      ))}
    </View>
  );
}

function OpeningForm({
  state,
  residenceId,
  refreshing,
  onRefresh,
}: {
  state: OpeningBalanceState;
  residenceId: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const format = useChargeFormat();
  const save = useSetOpeningBalance(residenceId);
  const today = useMemo(() => todayCasablanca(), []);
  const isCorrection = state.changes.length > 0;

  const [amount, setAmount] = useState(() => (isCorrection ? formatMadInput(state.openingBalance) : ''));
  const [asOfDate, setAsOfDate] = useState(state.openingBalanceDate ?? today);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<OpeningFormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/accounts'));

  const onSave = async () => {
    if (save.isPending) return;
    const result = validateOpeningBalance({ amount, asOfDate, reason }, isCorrection);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(undefined);
    try {
      const saved = await save.mutateAsync(result.input);
      setReason('');
      setToast(t(saved.corrected ? 'accounts.opening.corrected' : 'accounts.opening.saved'));
    } catch (caught) {
      // La saisie (montant, date, motif) est conservée pour réessayer.
      setFailure(apiErrorKey(caught));
    }
  };

  const display = format.date(asOfDate, 'long');

  return (
    <Screen
      scroll
      onRefresh={onRefresh}
      refreshing={refreshing}
      footer={
        <Button
          label={t(isCorrection ? 'accounts.opening.saveCorrection' : 'accounts.opening.save')}
          loading={save.isPending}
          onPress={() => void onSave()}
        />
      }>
      {toast !== undefined && <Toast message={toast} />}
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        <Text variant="h2">{t('accounts.opening.title')}</Text>
        <Text tone="muted">{t('accounts.opening.intro')}</Text>
      </View>

      {failure !== undefined && <ErrorNotice errorKey={failure} onRetry={() => void onSave()} retrying={save.isPending} />}

      <View style={{ gap: spacing.lg }}>
        <TextField
          label={t('accounts.opening.amount')}
          placeholder={t('expenses.field.amountPlaceholder')}
          suffix={t('expenses.field.currency')}
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setErrors((current) => ({ ...current, amount: undefined }));
          }}
          error={errorText(errors.amount)}
          editable={!save.isPending}
          keyboardType="decimal-pad"
          ltr
        />
        <View style={{ gap: spacing.xs }}>
          <DateField
            label={t('accounts.opening.date')}
            value={asOfDate}
            display={display}
            maximum={today}
            sheetTitle={t('accounts.opening.dateSheet')}
            onChange={(value) => {
              setAsOfDate(value);
              setErrors((current) => ({ ...current, asOfDate: undefined }));
            }}
          />
          {errors.asOfDate !== undefined && (
            <Text variant="small" tone="danger">
              {errorText(errors.asOfDate)}
            </Text>
          )}
        </View>
        {isCorrection && (
          <TextField
            label={t('accounts.opening.reason')}
            placeholder={t('accounts.opening.reasonPlaceholder')}
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              setErrors((current) => ({ ...current, reason: undefined }));
            }}
            maxLength={500}
            error={errorText(errors.reason)}
            editable={!save.isPending}
          />
        )}
      </View>

      {isCorrection ? (
        <NoticeBox title={t('accounts.opening.correctionTitle')} body={t('accounts.opening.correctionBody')} />
      ) : (
        <NoticeBox title={t('accounts.opening.noticeTitle')} body={t('accounts.opening.noticeBody')} />
      )}

      {isCorrection && <History changes={state.changes} />}
    </Screen>
  );
}

export function OpeningBalanceScreen() {
  const t = useT();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = openingBalanceResidenceId(active);
  const opening = useOpeningBalance(residenceId);
  useRefreshOnFocus(opening.refetch);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  if (opening.data === undefined || residenceId === undefined) {
    return (
      <Screen scroll>
        <AuthHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/accounts'))} />
        <QueryFallback query={opening} message={t('accounts.opening.loadError')} />
      </Screen>
    );
  }

  return (
    <OpeningForm
      state={opening.data}
      residenceId={residenceId}
      refreshing={opening.isRefetching}
      onRefresh={() => void opening.refetch()}
    />
  );
}
