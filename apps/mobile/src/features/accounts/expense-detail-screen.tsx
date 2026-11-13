// Écran 4 de docs/depenses.png : détail d'une dépense (facture, montant, catégorie, date, auteur
// par son rôle). « Voir la facture » demande une nouvelle URL signée à chaque ouverture. Annuler :
// uniquement avec `expenses.write`, motif obligatoire puis confirmation ; une dépense annulée
// affiche « Annulée le … : motif » pour tout le monde.
import { EXPENSE_ERRORS, formatMad } from '@syndic/shared';
import {
  Amount,
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  Screen,
  Sheet,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import Eye from 'lucide-react-native/icons/eye';
import FileText from 'lucide-react-native/icons/file-text';
import Receipt from 'lucide-react-native/icons/receipt';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import {
  useCancelExpense,
  useExpense,
  useInvoicePreview,
  useOpenInvoice,
  useRefreshExpenses,
  type ExpenseDetail,
} from '@/hooks/use-cash';
import { useActiveResidence } from '@/hooks/use-residences';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { accountsResidenceId, canCancelExpense, isPdf, validateCancelReason } from '@/lib/cash';
import { createClosingGate, runCancelFlow } from '@/lib/cancel-flow';

import { useAccountsFormat } from './use-accounts-format';

/** Durée d'affichage d'un toast, en millisecondes. */
const TOAST_MS = 3000;

function InvoicePreview({ expense, residenceId }: { expense: ExpenseDetail; residenceId: string }) {
  const t = useT();
  const { colors, radius, sizes, spacing } = useTheme();
  const image = expense.hasInvoice && !isPdf(expense.invoiceContentType);
  const preview = useInvoicePreview(residenceId, expense.id, image);

  let content: ReactNode;
  if (image && preview.data !== undefined) {
    content = (
      <Image
        source={{ uri: preview.data }}
        // Mémoire seulement : l'URL signée et la facture ne sont pas écrites sur le disque.
        cachePolicy="memory"
        contentFit="contain"
        accessibilityLabel={t('expenses.invoice.previewLabel')}
        style={{ width: '100%', height: '100%' }}
      />
    );
  } else if (image && preview.error === null) {
    content = <Text tone="muted">{t('common.loading')}</Text>;
  } else {
    const failed = image;
    content = (
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        <Icon icon={expense.hasInvoice && !failed ? FileText : Receipt} color={colors.textMuted} />
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {failed
            ? t('accounts.invoice.previewError')
            : t(expense.hasInvoice ? 'accounts.invoice.pdfBody' : 'accounts.invoice.noneBody')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        height: sizes.invoiceZone,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.primarySoft,
      }}>
      {content}
    </View>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text tone="muted">{label}</Text>
      {children}
    </View>
  );
}

export function ExpenseDetailScreen({ expenseId }: { expenseId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const format = useChargeFormat();
  const text = useAccountsFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = accountsResidenceId(active);
  const expense = useExpense(residenceId, expenseId);
  const openInvoice = useOpenInvoice();
  const cancel = useCancelExpense();
  const refreshExpenses = useRefreshExpenses(residenceId);
  // Attend la fin de la fermeture de la feuille avant d'actualiser l'écran (lib/cancel-flow.ts).
  const closingGate = useRef(createClosingGate()).current;

  const [step, setStep] = useState<'closed' | 'reason' | 'confirm'>('closed');
  // La feuille (Modal) n'existe que pendant l'annulation : démontée une fois fermée.
  const [sheetMounted, setSheetMounted] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [invoiceError, setInvoiceError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  useRefreshOnFocus(expense.refetch);
  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/accounts'));
  const data = expense.data;
  const canCancel = active !== null && canCancelExpense(active.role);

  const closeSheet = () => {
    if (cancel.isPending) return;
    setStep('closed');
    setReasonError(undefined);
    setCancelError(undefined);
  };

  const onContinue = () => {
    const result = validateCancelReason(reason);
    if (!result.ok) {
      setReasonError(result.errorKey);
      return;
    }
    setReasonError(undefined);
    setStep('confirm');
  };

  const onConfirm = async () => {
    if (cancel.isPending) return;
    const result = validateCancelReason(reason);
    if (!result.ok) {
      setStep('reason');
      setReasonError(result.errorKey);
      return;
    }
    setCancelError(undefined);
    // Envoi, fermeture de la feuille, attente de sa fermeture, démontage, puis actualisation de
    // l'écran : jamais l'inverse (sinon le retour peut rester bloqué sur iOS).
    await runCancelFlow({
      submit: async () => {
        await cancel.mutateAsync({ id: expenseId, reason: result.reason });
      },
      isAlreadyCancelled: (caught) => caught instanceof ApiError && caught.code === EXPENSE_ERRORS.alreadyCancelled,
      closeSheet: () => setStep('closed'),
      waitClosed: closingGate.wait,
      unmountSheet: () => {
        setSheetMounted(false);
        setReason('');
      },
      refresh: refreshExpenses,
      onCancelled: () => setToast(t('accounts.cancel.done')),
      onFailure: (caught) => {
        // Le motif saisi est conservé pour réessayer.
        setCancelError(apiErrorKey(caught));
        setStep('reason');
      },
    });
  };

  const openSheet = () => {
    setSheetMounted(true);
    setStep('reason');
  };

  const onView = async () => {
    if (openInvoice.isPending) return;
    setInvoiceError(undefined);
    try {
      await openInvoice.mutateAsync(expenseId);
    } catch (caught) {
      setInvoiceError(apiErrorKey(caught));
    }
  };

  const footer =
    data !== undefined && !data.cancelled ? (
      <>
        {data.hasInvoice && (
          <Button icon={Eye} label={t('accounts.invoice.view')} loading={openInvoice.isPending} onPress={() => void onView()} />
        )}
        {canCancel && (
          <>
            <Button
              variant="secondary"
              label={t('accounts.cancel.button')}
              onPress={openSheet}
            />
            <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
              {t('accounts.cancel.note')}
            </Text>
          </>
        )}
      </>
    ) : data !== undefined && data.hasInvoice ? (
      <Button icon={Eye} label={t('accounts.invoice.view')} loading={openInvoice.isPending} onPress={() => void onView()} />
    ) : undefined;

  let body: ReactNode;
  if (data === undefined || residenceId === undefined) {
    body = <QueryFallback query={expense} message={t('accounts.detail.loadError')} />;
  } else {
    body = (
      <>
        {expense.isRefetchError && <Banner message={t('accounts.detail.loadError')} />}
        <InvoicePreview expense={data} residenceId={residenceId} />
        {data.cancelled && (
          <View style={{ gap: spacing.sm }}>
            <Badge tone="info" label={t('accounts.badge.cancelled')} />
            <Banner
              tone="info"
              message={t('accounts.cancelled.line', {
                date: format.instant(data.cancelledAt ?? data.createdAt, 'long'),
                reason: data.cancelReason ?? '',
              })}
            />
          </View>
        )}
        {invoiceError !== undefined && <Banner message={errorText(invoiceError) ?? ''} />}
        <Card>
          <InfoRow label={t('accounts.detail.amount')}>
            <Amount
              centimes={data.amount}
              direction="out"
              style={data.cancelled ? { textDecorationLine: 'line-through' } : undefined}
            />
          </InfoRow>
          <InfoRow label={t('accounts.detail.recordedBy')}>
            <Text variant="bodyStrong">{text.author(data.recordedByRole)}</Text>
          </InfoRow>
          <InfoRow label={t('accounts.detail.invoice')}>
            <Text variant="bodyStrong">
              {data.hasInvoice
                ? text.invoiceLine(data.invoiceContentType, data.invoiceSize)
                : t('accounts.invoice.none')}
            </Text>
          </InfoRow>
        </Card>
      </>
    );
  }

  const screen = (
    <Screen scroll footer={footer} onRefresh={() => void expense.refetch()} refreshing={expense.isRefetching}>
      {toast !== undefined && <Toast message={toast} />}
      <AuthHeader onBack={goBack} />
      {data !== undefined && (
        <View style={{ gap: spacing.xs }}>
          <Text variant="h2">{data.label}</Text>
          <Text tone="muted">
            {t('accounts.ledger.expenseLine', {
              category: text.category(data.category),
              date: format.date(data.spentOn, 'long'),
            })}
          </Text>
        </View>
      )}
      {body}
    </Screen>
  );

  // La feuille est un frère de l'écran, pas son enfant : quand l'écran change (pied de page retiré
  // à l'annulation), la Modal n'est pas remontée avec lui. Elle n'est montée que pendant l'annulation.
  const sheet = sheetMounted && (
    <Sheet
      visible={data !== undefined && step !== 'closed'}
      title={t(step === 'confirm' ? 'accounts.cancel.confirmTitle' : 'accounts.cancel.sheetTitle')}
      dismissLabel={t('common.closeSheet')}
      onClose={closeSheet}
      onDismissed={() => {
        closingGate.notifyClosed();
        if (step === 'closed') setSheetMounted(false);
      }}
      footer={
        step === 'confirm' ? (
          <>
            <Button label={t('accounts.cancel.confirm')} loading={cancel.isPending} onPress={() => void onConfirm()} />
            <Button
              variant="ghost"
              label={t('accounts.cancel.back')}
              disabled={cancel.isPending}
              onPress={() => setStep('reason')}
            />
          </>
        ) : (
          <>
            <Button label={t('accounts.cancel.continue')} onPress={onContinue} />
            <Button variant="ghost" label={t('common.cancel')} onPress={closeSheet} />
          </>
        )
      }>
      {step === 'confirm' ? (
        <Text>{t('accounts.cancel.confirmBody', { amount: formatMad(data?.amount ?? 0) })}</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label={t('accounts.cancel.reason')}
            placeholder={t('accounts.cancel.reasonPlaceholder')}
            helper={t('accounts.cancel.reasonHelp')}
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              setReasonError(undefined);
            }}
            maxLength={500}
            error={errorText(reasonError)}
          />
          {cancelError !== undefined && <Banner message={errorText(cancelError) ?? ''} />}
        </View>
      )}
    </Sheet>
  );

  return (
    <>
      {screen}
      {sheet}
    </>
  );
}
