// Écran 4 de docs/charges.png : encaisser en 3 gestes depuis « Charges »
// (Encaisser → appartement → Confirmer). Mode espèces par défaut, montant pré-rempli avec le reste ;
// un montant plus petit enregistre un paiement partiel.
import { can, formatMad, type PaymentMethod } from '@syndic/shared';
import {
  Banner,
  Button,
  ChoiceTile,
  EmptyState,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Wallet from 'lucide-react-native/icons/wallet';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useChargeCall, useChargeCalls, useCreatePayment, type DueRow } from '@/hooks/use-charges';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { formatMadInput, parseMadInput } from '@/lib/charges-format';

import { QueryFallback } from './query-fallback';

/** Durée d'affichage du toast de confirmation, en millisecondes. */
const TOAST_MS = 3500;
const naturalOrder = new Intl.Collator('fr', { numeric: true });

export function CollectScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ callId?: string; dueId?: string }>();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed =
    active !== null && can(active.role, 'payments.write') && can(active.role, 'accounts.read');
  const residenceId = allowed ? active.id : undefined;
  // Sans appel précisé : l'appel en cours (le plus récent).
  const calls = useChargeCalls(params.callId === undefined ? residenceId : undefined);
  const callId = params.callId ?? calls.data?.[0]?.id;
  const call = useChargeCall(residenceId, callId);
  const createPayment = useCreatePayment(residenceId);

  const [selectedId, setSelectedId] = useState<string | undefined>(params.dueId);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  // Saisie du montant ; sans saisie, le reste de l'appartement choisi est pré-rempli.
  const [amountDraft, setAmountDraft] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Appartements impayés ou partiels, par référence.
  const open = useMemo(
    () =>
      (call.data?.dues ?? [])
        .filter((due) => due.status !== 'paid')
        .sort((a, b) => naturalOrder.compare(a.lotReference, b.lotReference)),
    [call.data],
  );
  const selected = open.find((due) => due.id === selectedId);
  const amountText =
    amountDraft ?? (selected === undefined ? '' : formatMadInput(selected.remaining));

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/charges" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/charges'));
  const amount = parseMadInput(amountText);

  const choose = (due: DueRow) => {
    setSelectedId(due.id);
    setAmountDraft(undefined);
    setAmountError(undefined);
    setError(undefined);
  };

  const onConfirm = async () => {
    if (selected === undefined || createPayment.isPending) return;
    if (amount === undefined) {
      setAmountError(t('charges.amountInvalid'));
      return;
    }
    if (amount > selected.remaining) {
      setAmountError(t('charges.errors.amountExceedsRemaining'));
      return;
    }
    setError(undefined);
    try {
      await createPayment.mutateAsync({ chargeDueId: selected.id, amount, method });
      setToast(
        t('charges.collect.toast', { amount: formatMad(amount), lot: selected.lotReference }),
      );
      // Prêt pour l'encaissement suivant ; la grille se met à jour (requêtes invalidées).
      setSelectedId(undefined);
      setAmountDraft(undefined);
    } catch (caught) {
      // 409 (montant supérieur au reste) ou réseau : la saisie reste affichée pour corriger.
      setError(t(apiErrorKey(caught)));
    }
  };

  let body;
  if (params.callId === undefined && calls.data === undefined) {
    body = <QueryFallback query={calls} message={t('charges.loadError')} />;
  } else if (callId === undefined) {
    body = (
      <EmptyState
        icon={Wallet}
        title={t('charges.collect.noCallTitle')}
        description={t('charges.collect.noCallBody')}
      />
    );
  } else if (call.data === undefined) {
    body = <QueryFallback query={call} message={t('charges.loadError')} />;
  } else if (open.length === 0) {
    body = (
      <EmptyState
        icon={CircleCheck}
        title={t('charges.collect.allPaidTitle')}
        description={t('charges.collect.allPaidBody')}
      />
    );
  } else {
    body = (
      <>
        {call.error && <Banner message={t('charges.loadError')} />}
        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">{t('charges.collect.who')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {open.map((due) => (
              <ChoiceTile
                key={due.id}
                label={due.lotReference}
                selected={due.id === selectedId}
                accessibilityLabel={t('charges.collect.tileLabel', {
                  lot: due.lotReference,
                  amount: formatMad(due.remaining),
                })}
                onPress={() => choose(due)}
                style={{ flexBasis: '30%', flexGrow: 1 }}
              />
            ))}
          </View>
          <Text variant="small" tone="muted">
            {t(open.length === 1 ? 'charges.collect.countOne' : 'charges.collect.countMany', {
              count: open.length,
            })}
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">{t('charges.collect.how')}</Text>
          <SegmentedControl<PaymentMethod>
            options={[
              { value: 'cash', label: t('charges.method.cash') },
              { value: 'transfer', label: t('charges.method.transfer') },
            ]}
            value={method}
            onChange={setMethod}
          />
        </View>

        <TextField
          label={t('charges.collect.amount')}
          value={amountText}
          onChangeText={(text) => {
            setAmountDraft(text);
            setAmountError(undefined);
          }}
          keyboardType="decimal-pad"
          ltr
          editable={selected !== undefined}
          helper={t('charges.collect.amountHelp')}
          error={amountError}
        />

        {error !== undefined && <Banner message={error} />}
      </>
    );
  }

  const confirmLabel =
    selected === undefined
      ? t('charges.collect.choose')
      : t('charges.collect.confirm', {
          lot: selected.lotReference,
          amount: amount === undefined ? '—' : formatMad(amount),
        });

  return (
    <Screen
      scroll
      footer={
        open.length > 0 ? (
          <>
            <Button
              label={confirmLabel}
              disabled={selected === undefined}
              loading={createPayment.isPending}
              onPress={() => void onConfirm()}
            />
            <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
              {t('charges.collect.note')}
            </Text>
          </>
        ) : undefined
      }
    >
      {toast !== undefined && <Toast message={toast} />}
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('charges.collect.title')}</Text>
      {body}
    </Screen>
  );
}
