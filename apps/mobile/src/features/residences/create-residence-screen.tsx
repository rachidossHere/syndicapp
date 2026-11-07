// Écran 1 de docs/residences.png : créer ma résidence (étape 1 sur 2).
import { createResidenceSchema, type CreateResidenceInput } from '@syndic/shared';
import { Banner, Button, Screen, Text, TextField, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useCreateResidence } from '@/hooks/use-residences';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';

import { keyedResolver } from './field-errors';
import { Notice } from './notice';

const FIELD_KEYS = {
  name: 'residences.errors.nameInvalid',
  city: 'residences.errors.cityInvalid',
  address: 'residences.errors.addressInvalid',
};

export function CreateResidenceScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const createResidence = useCreateResidence();
  const [formError, setFormError] = useState<string | undefined>();

  const { control, handleSubmit } = useForm<CreateResidenceInput>({
    resolver: keyedResolver<CreateResidenceInput>(createResidenceSchema, FIELD_KEYS),
    defaultValues: { name: '', city: '', address: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submitForm = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await createResidence.mutateAsync(values);
      router.replace({ pathname: '/add-lots', params: { onboarding: '1' } });
    } catch (error) {
      // Le brouillon reste dans le formulaire : l'utilisateur peut réessayer.
      setFormError(apiErrorKey(error));
    }
  });
  const onSubmit = () => {
    if (createResidence.isPending) return;
    void submitForm();
  };
  const busy = createResidence.isPending;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  return (
    <Screen
      scroll
      footer={<Button label={t('common.continue')} loading={busy} onPress={onSubmit} />}>
      <AuthHeader onBack={goBack} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" tone="primary">
          {t('common.step', { current: 1, total: 2 })}
        </Text>
        <Text variant="h2">{t('residences.create.title')}</Text>
        <Text tone="muted">{t('residences.create.subtitle')}</Text>
      </View>

      {formError !== undefined && <Banner message={errorText(formError) ?? t('auth.errors.unknown')} />}

      <View style={{ gap: spacing.md }}>
        <Controller
          control={control}
          name="name"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('residences.create.name')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!busy}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="city"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('residences.create.city')}
              placeholder={t('residences.create.cityPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!busy}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="address"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('residences.create.address')}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />
      </View>

      <Notice icon={ShieldCheck} message={t('residences.create.notice')} />
    </Screen>
  );
}
