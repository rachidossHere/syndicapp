// Écran 2 de docs/auth.png : inscription (erreurs sous chaque champ).
import { signUpSchema, type SignUpInput } from '@syndic/shared';
import { Button, Screen, Text, TextField, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useSession } from '@/hooks/use-session';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { schemaResolver } from '@/lib/form-resolver';

import { AuthHeader } from './auth-header';
import { InlineLink } from './inline-link';
import { useGoBack } from './use-go-back';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const;

export function SignUpScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const goBack = useGoBack();
  const { signUp } = useSession();
  const [formError, setFormError] = useState<string | undefined>();

  const { control, handleSubmit, setError, formState } = useForm<SignUpInput>({
    resolver: schemaResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submitForm = handleSubmit(async (values) => {
    setFormError(undefined);
    const result = await signUp(values);
    if (result.ok) return; // la navigation protégée affiche « Bonjour »
    for (const field of FIELDS) {
      const key = result.fields?.[field];
      if (key) setError(field, { type: 'server', message: key });
    }
    setFormError(result.formError);
  });
  // Pas de double envoi : le bouton est désactivé pendant l'envoi, et ce verrou couvre aussi
  // la touche « Terminé » du clavier. onPress passe un événement React Native, non transmis.
  const onSubmit = () => {
    if (formState.isSubmitting) return;
    void submitForm();
  };

  const labels = {
    name: t('signUp.name'),
    email: t('signUp.email'),
    password: t('signUp.password'),
    confirmPassword: t('signUp.confirmPassword'),
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('signUp.submit')} loading={formState.isSubmitting} onPress={onSubmit} />
          <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {t('signUp.legal')}
          </Text>
          <InlineLink
            question={t('signUp.haveAccount')}
            action={t('signUp.signInLink')}
            onPress={() => router.replace('/sign-in')}
          />
        </>
      }>
      <AuthHeader onBack={goBack} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="h2">{t('signUp.title')}</Text>
        <Text tone="muted">{t('signUp.subtitle')}</Text>
      </View>

      {formError !== undefined && <ErrorNotice errorKey={formError} />}

      <View style={{ gap: spacing.md }}>
        {FIELDS.map((field) => (
          <Controller
            key={field}
            control={control}
            name={field}
            render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
              <TextField
                ref={ref}
                label={labels[field]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errorText(fieldState.error?.message)}
                editable={!formState.isSubmitting}
                autoCapitalize={field === 'name' ? 'words' : 'none'}
                autoCorrect={false}
                {...(field === 'name' && { autoComplete: 'name', textContentType: 'name' })}
                {...(field === 'email' && {
                  ltr: true,
                  keyboardType: 'email-address',
                  autoComplete: 'email',
                  textContentType: 'emailAddress',
                })}
                {...((field === 'password' || field === 'confirmPassword') && {
                  password: true,
                  autoComplete: 'new-password',
                  textContentType: 'newPassword',
                })}
                returnKeyType={field === 'confirmPassword' ? 'done' : 'next'}
                onSubmitEditing={field === 'confirmPassword' ? onSubmit : undefined}
              />
            )}
          />
        ))}
      </View>
    </Screen>
  );
}
