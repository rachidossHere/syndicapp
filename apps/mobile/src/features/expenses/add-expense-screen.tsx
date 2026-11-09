// Écrans 2 et 3 de docs/depenses.png : « Nouvelle dépense » (facture en photo, libellé, montant,
// date, catégorie). Facture facultative : sans facture, la dépense apparaîtra « Sans facture » pour tous.
// Enregistrement : URL d'envoi → envoi direct vers R2 (progression) → création avec la clé.
// Le client_id est créé à l'ouverture et réutilisé à chaque essai : jamais de doublon.
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL_KEYS,
  can,
} from '@syndic/shared';
import { Banner, Button, Chip, ProgressBar, Screen, Text, TextField, useTheme } from '@syndic/ui';
import * as Crypto from 'expo-crypto';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { DateField } from '@/features/charges/date-field';
import { useCreateExpense } from '@/hooks/use-expenses';
import { useActiveResidence } from '@/hooks/use-residences';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import type { TranslationKey } from '@/i18n/translate';
import { apiErrorKey } from '@/lib/api-errors';
import { dateParts, todayCasablanca } from '@/lib/charges-format';
import { expenseFieldsFrom, expenseFormSchema, type ExpenseFormValues } from '@/lib/expense-form';
import type { UploadedInvoice } from '@/lib/expense-save';
import { setFlashMessage } from '@/lib/flash-message';
import { schemaResolver } from '@/lib/form-resolver';

import { InvoiceZone } from './invoice-zone';
import { useInvoicePicker } from './use-invoice-picker';

// Clés construites à partir d'identifiants fermés : leur existence en FR et en AR est testée.
const key = (value: string) => value as TranslationKey;

export function AddExpenseScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'expenses.write');
  const create = useCreateExpense(allowed ? active.id : undefined);

  const today = useMemo(() => todayCasablanca(), []);
  // Créé une seule fois à l'ouverture du formulaire, réutilisé à chaque nouvel essai.
  const [clientId] = useState(() => Crypto.randomUUID());
  // Facture déjà envoyée vers R2 : un nouvel essai ne la renvoie pas.
  const uploaded = useRef<UploadedInvoice | undefined>(undefined);
  const picker = useInvoicePicker();
  const [progress, setProgress] = useState<number | undefined>();
  const [failure, setFailure] = useState<string | undefined>();

  const { control, handleSubmit, watch, setValue, formState } = useForm<ExpenseFormValues>({
    resolver: schemaResolver(expenseFormSchema(today)),
    defaultValues: { label: '', amount: '', spentOn: today, category: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const values = watch();

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const saving = formState.isSubmitting;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  // Formulaire encore vide : bouton grisé (écran 2). Dès la première saisie, les erreurs s'affichent à l'envoi.
  const untouched = values.label === '' && values.amount === '' && values.category === '' && picker.invoice === undefined;

  const submitForm = handleSubmit(async (input) => {
    const fields = expenseFieldsFrom(input, today);
    if (fields === undefined) return;
    const invoice = picker.invoice;
    setFailure(undefined);
    setProgress(invoice === undefined ? undefined : 0);
    try {
      await create.mutateAsync({ fields, clientId, invoice, uploaded, onProgress: setProgress });
      setFlashMessage(invoice === undefined ? 'expenses.toast.withoutInvoice' : 'expenses.toast.withInvoice');
      goBack();
    } catch (caught) {
      // La saisie, le client_id et la facture déjà envoyée restent : « Réessayer » ne crée pas de doublon.
      setFailure(apiErrorKey(caught));
    } finally {
      setProgress(undefined);
    }
  });
  // Pas de double envoi : le verrou couvre aussi la touche « Terminé » du clavier.
  const onSubmit = () => {
    if (saving) return;
    void submitForm();
  };

  const percent = Math.round((progress ?? 0) * 100);
  const uploading = saving && picker.invoice !== undefined && progress !== undefined && progress < 1;
  const invoiceError = errorText(picker.errorKey);
  const display = (value: string) => {
    const { year, month, day } = dateParts(value);
    return t('expenses.date.display', {
      day,
      month: t(key(`charges.dateMonthsShort.${month}`)),
      year,
    });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          {uploading && (
            <View style={{ gap: spacing.xs }}>
              <ProgressBar value={progress ?? 0} accessibilityLabel={t('expenses.uploading', { percent })} />
              <Text variant="small" tone="muted">
                {t('expenses.uploading', { percent })}
              </Text>
            </View>
          )}
          <Button
            label={t('expenses.submit')}
            loading={saving}
            disabled={untouched || picker.busy}
            onPress={onSubmit}
          />
          <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {t(picker.invoice === undefined ? 'expenses.note.withoutInvoice' : 'expenses.note.withInvoice')}
          </Text>
        </>
      }>
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('expenses.add.title')}</Text>

      <View style={{ gap: spacing.sm }}>
        <InvoiceZone
          invoice={picker.invoice}
          disabled={saving}
          busy={picker.busy}
          onTakePhoto={() => void picker.takePhoto()}
          onChooseImage={() => void picker.chooseImage()}
          onChoosePdf={() => void picker.choosePdf()}
          onRemove={picker.remove}
        />
        {invoiceError !== undefined && <Banner message={invoiceError} />}
      </View>

      {failure !== undefined && <ErrorNotice errorKey={failure} onRetry={onSubmit} retrying={saving} />}

      <View style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="label"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('expenses.field.label')}
              placeholder={t('expenses.field.labelPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!saving}
              returnKeyType="next"
            />
          )}
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Controller
            control={control}
            name="amount"
            render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
              <TextField
                ref={ref}
                containerStyle={{ flex: 1 }}
                label={t('expenses.field.amount')}
                placeholder={t('expenses.field.amountPlaceholder')}
                suffix={t('expenses.field.currency')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errorText(fieldState.error?.message)}
                editable={!saving}
                keyboardType="decimal-pad"
                ltr
              />
            )}
          />
          <Controller
            control={control}
            name="spentOn"
            render={({ field: { value, onChange }, fieldState }) => (
              <View style={{ flex: 1, gap: spacing.xs }}>
                <DateField
                  label={t('expenses.field.date')}
                  value={value}
                  display={display(value)}
                  maximum={today}
                  sheetTitle={t('expenses.field.dateSheet')}
                  onChange={onChange}
                />
                {fieldState.error?.message !== undefined && (
                  <Text variant="small" tone="danger">
                    {errorText(fieldState.error.message)}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="category"
          render={({ field: { value }, fieldState }) => (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('expenses.field.category')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <Chip
                    key={category}
                    label={t(key(EXPENSE_CATEGORY_LABEL_KEYS[category]))}
                    selected={value === category}
                    disabled={saving}
                    onPress={() => setValue('category', category, { shouldValidate: formState.isSubmitted })}
                  />
                ))}
              </View>
              {fieldState.error?.message !== undefined && (
                <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
                  {errorText(fieldState.error.message)}
                </Text>
              )}
            </View>
          )}
        />
      </View>
    </Screen>
  );
}
