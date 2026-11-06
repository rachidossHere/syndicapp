// Écran de test de l'authentification (plan 03, étape 5), réservé au développement.
// Les erreurs sont affichées sous forme de clés de traduction : les écrans définitifs (étape 6)
// les traduiront. Rien n'est journalisé ; seule la présence du cookie est affichée, jamais sa valeur.
import { Button, Card, Screen, Text, TextField, Toast, useTheme } from '@syndic/ui';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import type { AuthResult } from '@/lib/auth-errors';

/** Clé SecureStore du cookie de session (storagePrefix « syndicapp » de expoClient). */
const COOKIE_STORE_KEY = 'syndicapp_cookie';

type Errors = Exclude<AuthResult, { ok: true }>;

export function AuthTestScreen() {
  const { spacing } = useTheme();
  const { user, isLoading, signUp, signIn, signOut } = useSession();
  const me = useMe(user !== null);

  const [signUpForm, setSignUpForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [signUpErrors, setSignUpErrors] = useState<Errors | null>(null);
  const [signInErrors, setSignInErrors] = useState<Errors | null>(null);
  const [pending, setPending] = useState<'signUp' | 'signIn' | 'signOut' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cookieStored, setCookieStored] = useState<boolean | null>(null);

  /** Présence d'un cookie de session dans SecureStore (la valeur n'est jamais lue à l'écran). */
  const refreshStorage = useCallback(async () => {
    const value = await SecureStore.getItemAsync(COOKIE_STORE_KEY);
    setCookieStored(value !== null && value !== '' && value !== '{}');
  }, []);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage, user]);

  const submitSignUp = async () => {
    if (pending) return;
    setPending('signUp');
    const result = await signUp(signUpForm);
    setPending(null);
    setSignUpErrors(result.ok ? null : result);
    if (result.ok) {
      setSignUpForm({ name: '', email: '', password: '', confirmPassword: '' });
      setNotice('Compte créé, session ouverte');
    }
  };

  const submitSignIn = async () => {
    if (pending) return;
    setPending('signIn');
    const result = await signIn(signInForm);
    setPending(null);
    setSignInErrors(result.ok ? null : result);
    if (result.ok) {
      setSignInForm({ email: '', password: '' });
      setNotice('Connecté');
    }
  };

  const submitSignOut = async () => {
    if (pending) return;
    setPending('signOut');
    await signOut();
    setPending(null);
    setNotice('Déconnecté');
    await refreshStorage();
  };

  return (
    <Screen scroll>
      <LanguageToggle />
      {notice !== null && <Toast message={notice} />}

      <Card>
        <Text variant="h3">Session</Text>
        <Text>
          {isLoading ? 'Chargement…' : user ? `Connecté : ${user.name} (${user.email})` : 'Déconnecté'}
        </Text>
        <Text variant="small" tone="muted">
          {`Cookie dans SecureStore : ${cookieStored === null ? '…' : cookieStored ? 'présent' : 'absent'} · AsyncStorage : non utilisé`}
        </Text>
        {user !== null && (
          <Button variant="secondary" label="Se déconnecter" loading={pending === 'signOut'} onPress={submitSignOut} />
        )}
      </Card>

      <Card>
        <Text variant="h3">GET /api/me</Text>
        {user === null ? (
          <Text tone="muted">Pas de session : requête non envoyée.</Text>
        ) : me.data !== undefined ? (
          <Text selectable>{JSON.stringify(me.data)}</Text>
        ) : me.error ? (
          <View style={{ gap: spacing.sm }}>
            <Text tone="danger">{me.error.message}</Text>
            <Button variant="secondary" label="Réessayer" onPress={() => void me.refetch()} />
          </View>
        ) : (
          <Text tone="muted">Chargement…</Text>
        )}
        {me.data !== undefined && (
          <Button variant="ghost" label="Rappeler /api/me" loading={me.isFetching} onPress={() => void me.refetch()} />
        )}
      </Card>

      <Card>
        <Text variant="h3">Inscription</Text>
        <TextField
          label="Nom complet"
          value={signUpForm.name}
          onChangeText={(name) => setSignUpForm((f) => ({ ...f, name }))}
          error={signUpErrors?.fields?.name}
          autoComplete="name"
        />
        <TextField
          label="Adresse e-mail"
          value={signUpForm.email}
          onChangeText={(email) => setSignUpForm((f) => ({ ...f, email }))}
          error={signUpErrors?.fields?.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Mot de passe"
          value={signUpForm.password}
          onChangeText={(password) => setSignUpForm((f) => ({ ...f, password }))}
          error={signUpErrors?.fields?.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <TextField
          label="Confirmer le mot de passe"
          value={signUpForm.confirmPassword}
          onChangeText={(confirmPassword) => setSignUpForm((f) => ({ ...f, confirmPassword }))}
          error={signUpErrors?.fields?.confirmPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        {signUpErrors?.formError !== undefined && <Text tone="danger">{signUpErrors.formError}</Text>}
        <Button label="Créer le compte" loading={pending === 'signUp'} onPress={submitSignUp} />
      </Card>

      <Card>
        <Text variant="h3">Connexion</Text>
        <TextField
          label="Adresse e-mail"
          value={signInForm.email}
          onChangeText={(email) => setSignInForm((f) => ({ ...f, email }))}
          error={signInErrors?.fields?.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Mot de passe"
          value={signInForm.password}
          onChangeText={(password) => setSignInForm((f) => ({ ...f, password }))}
          error={signInErrors?.fields?.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
        {signInErrors?.formError !== undefined && <Text tone="danger">{signInErrors.formError}</Text>}
        <Button label="Se connecter" loading={pending === 'signIn'} onPress={submitSignIn} />
      </Card>
    </Screen>
  );
}
