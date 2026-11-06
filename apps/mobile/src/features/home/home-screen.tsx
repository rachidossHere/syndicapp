// Écran 4 de docs/auth.png : « Bonjour {prénom} » après connexion ou inscription.
import { AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';
import { Banner, Button, Card, Icon, Screen, Text, Toast, useTheme } from '@syndic/ui';
import KeyRound from 'lucide-react-native/icons/key-round';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { currentNetworkErrorKey } from '@/lib/network';
import { consumeJustSignedUp } from '@/lib/welcome-flag';

/** Durée d'affichage du toast de bienvenue, en millisecondes. */
const WELCOME_TOAST_MS = 4000;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function HomeScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const { signOut } = useSession();
  const me = useMe(true);
  const [showWelcome, setShowWelcome] = useState(consumeJustSignedUp);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();
  const [meErrorKey, setMeErrorKey] = useState<AuthErrorKey>(AUTH_ERROR_KEYS.network);

  useEffect(() => {
    if (!showWelcome) return;
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_TOAST_MS);
    return () => clearTimeout(timer);
  }, [showWelcome]);

  // Erreur réseau sur /api/me : « pas de connexion » ou « serveur injoignable » (expo-network).
  const meNetworkFailure = me.error instanceof ApiError && me.error.status === 0;
  useEffect(() => {
    if (!meNetworkFailure) return;
    let active = true;
    void currentNetworkErrorKey().then((key) => {
      if (active) setMeErrorKey(key);
    });
    return () => {
      active = false;
    };
  }, [meNetworkFailure, me.errorUpdatedAt]);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(undefined);
    // En cas de succès, la navigation protégée renvoie à l'accueil et retire « Bonjour » de
    // l'historique. Sans réseau, la session reste ouverte et l'erreur est affichée.
    const result = await signOut();
    if (!result.ok) {
      setSignOutError(result.formError);
      setSigningOut(false);
    }
  };

  const choices = [
    {
      key: 'create',
      icon: Plus,
      background: colors.primarySoft,
      foreground: colors.primary,
      title: t('home.createResidenceTitle'),
      body: t('home.createResidenceBody'),
    },
    {
      key: 'join',
      icon: KeyRound,
      background: colors.warningBg,
      foreground: colors.warningFg,
      title: t('home.joinResidenceTitle'),
      body: t('home.joinResidenceBody'),
    },
  ];

  return (
    <Screen
      scroll
      footer={
        <>
          {signOutError !== undefined && <ErrorNotice errorKey={signOutError} />}
          <Button variant="ghost" label={t('home.signOut')} loading={signingOut} onPress={() => void onSignOut()} />
        </>
      }>
      {showWelcome && <Toast message={t('home.welcomeToast')} />}

      {me.data !== undefined ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="h2">{t('home.greeting', { name: firstName(me.data.name) })}</Text>
          <Text tone="muted">{t('home.noResidence')}</Text>
        </View>
      ) : me.error && meNetworkFailure ? (
        <ErrorNotice errorKey={meErrorKey} onRetry={() => void me.refetch()} retrying={me.isFetching} />
      ) : me.error ? (
        <View style={{ gap: spacing.md }}>
          <Banner message={t('home.loadError')} />
          <Button variant="secondary" label={t('common.retry')} loading={me.isFetching} onPress={() => void me.refetch()} />
        </View>
      ) : (
        <Text tone="muted">{t('common.loading')}</Text>
      )}

      {me.data !== undefined && (
        <View style={{ gap: spacing.md }}>
          {/* Sans action pour l'instant : la création et l'invitation arrivent au plan 04. */}
          {choices.map((choice) => (
            <Card key={choice.key}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View
                  style={{
                    width: sizes.iconBox,
                    height: sizes.iconBox,
                    borderRadius: radius.sm,
                    borderCurve: 'continuous',
                    backgroundColor: choice.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon icon={choice.icon} color={choice.foreground} />
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text variant="h3">{choice.title}</Text>
                  <Text variant="small" tone="muted">
                    {choice.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
