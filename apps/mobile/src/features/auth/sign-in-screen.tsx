// Écrans 3 et 5 de docs/auth.png : connexion, avec bandeau d'erreur générique.
import { signInSchema, type SignInInput } from '@syndic/shared';
import { Banner, Button, Screen, Text, TextField, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { useSession } from '@/hooks/use-session';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { schemaResolver } from '@/lib/form-resolver';

import { AuthHeader } from './auth-header';
import { InlineLink } from './inline-link';
import { useGoBack } from './use-go-back';

export function SignInScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const goBack = useGoBack();
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | undefined>();

  const { control, handleSubmit, setError, formState } = useForm<SignInInput>({
    resolver: schemaResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submitForm = handleSubmit(async (values) => {
    setFormError(undefined);
    const result = await signIn(values);
    if (result.ok) return; // la navigation protégée affiche « Bonjour »
    if (result.fields?.email) setError('email', { type: 'server', message: result.fields.email });
    if (result.fields?.password) setError('password', { type: 'server', message: result.fields.password });
    // Même bandeau pour un e-mail inconnu et un mauvais mot de passe.
    setFormError(result.formError);
  });
  // Pas de double envoi : le bouton est désactivé pendant l'envoi, et ce verrou couvre aussi
  // la touche « Terminé » du clavier. onPress passe un événement React Native, non transmis.
  const onSubmit = () => {
    if (formState.isSubmitting) return;
    void submitForm();
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('signIn.submit')} loading={formState.isSubmitting} onPress={onSubmit} />
          <InlineLink
            question={t('signIn.noAccount')}
            action={t('signIn.signUpLink')}
            onPress={() => router.replace('/sign-up')}
          />
        </>
      }>
      <AuthHeader onBack={goBack} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="h2">{t('signIn.title')}</Text>
        <Text tone="muted">{t('signIn.subtitle')}</Text>
      </View>

      {formError !== undefined && <Banner message={errorText(formError) ?? ''} />}

      <View style={{ gap: spacing.md }}>
        <Controller
          control={control}
          name="email"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('signIn.email')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!formState.isSubmitting}
              ltr
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('signIn.password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!formState.isSubmitting}
              password
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />
      </View>
    </Screen>
  );
}
