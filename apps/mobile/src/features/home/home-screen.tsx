// Écran 4 de docs/auth.png : « Bonjour {prénom} » après connexion ou inscription.
// Sans résidence : deux choix (créer, rejoindre). Avec une résidence : accueil provisoire (plan 04),
// dont les entrées dépendent du rôle (l'API refuse de toute façon ce que le rôle ne permet pas).
import { AUTH_ERROR_KEYS, can, type AuthErrorKey } from '@syndic/shared';
import { Banner, Button, Card, Chip, Icon, ListItem, Screen, Text, Toast, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import Building2 from 'lucide-react-native/icons/building-2';
import KeyRound from 'lucide-react-native/icons/key-round';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useRoleLabel } from '@/features/residences/use-role-label';
import { useMe } from '@/hooks/use-me';
import { useActiveResidence } from '@/hooks/use-residences';
import { useSession } from '@/hooks/use-session';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { currentNetworkErrorKey } from '@/lib/network';
import { consumeJustSignedUp } from '@/lib/welcome-flag';

/** Durée d'affichage du toast de bienvenue, en millisecondes. */
const WELCOME_TOAST_MS = 4000;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function HomeScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();
  const roleLabel = useRoleLabel();
  const { signOut } = useSession();
  const me = useMe(true);
  const { active, residences, query: residencesQuery, setActive } = useActiveResidence();
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
    let live = true;
    void currentNetworkErrorKey().then((key) => {
      if (live) setMeErrorKey(key);
    });
    return () => {
      live = false;
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
      onPress: () => router.push('/create-residence'),
    },
    {
      key: 'join',
      icon: KeyRound,
      background: colors.warningBg,
      foreground: colors.warningFg,
      title: t('home.joinResidenceTitle'),
      body: t('home.joinResidenceBody'),
      onPress: () => router.push('/join'),
    },
  ];

  const subtitle =
    active !== null
      ? t('home.residenceLine', { name: active.name, role: roleLabel(active.role, { lower: true }) })
      : residencesQuery.data !== undefined
        ? t('home.noResidence')
        : undefined;

  let content;
  if (me.data === undefined) {
    content = null;
  } else if (residencesQuery.data === undefined) {
    content = residencesQuery.error ? (
      <View style={{ gap: spacing.md }}>
        <ErrorNotice
          errorKey={apiErrorKey(residencesQuery.error)}
          onRetry={() => void residencesQuery.refetch()}
          retrying={residencesQuery.isFetching}
        />
      </View>
    ) : (
      <Text tone="muted">{t('common.loading')}</Text>
    );
  } else if (active !== null) {
    content = (
      <View style={{ gap: spacing.lg }}>
        {/* Plusieurs résidences : un sélecteur simple (puces) change la résidence active. */}
        {residences !== undefined && residences.length > 1 && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('residences.switcher.label')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {residences.map((residence) => (
                <Chip
                  key={residence.id}
                  label={residence.name}
                  selected={residence.id === active.id}
                  onPress={() => setActive(residence.id)}
                />
              ))}
            </View>
          </View>
        )}
        {can(active.role, 'lots.write') && (
          <ListItem
            title={t('home.lots')}
            subtitle={t('home.lotsBody')}
            leading={
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={Building2} color={colors.primary} />
              </View>
            }
            onPress={() => router.push('/lots')}
          />
        )}
        {/* Un refus d'actualisation de la liste garde l'accueil affiché, avec un message. */}
        {residencesQuery.error && <Banner message={t('home.residenceError')} />}
      </View>
    );
  } else {
    content = (
      <View style={{ gap: spacing.md }}>
        {choices.map((choice) => (
          <Pressable
            key={choice.key}
            accessibilityRole="button"
            accessibilityLabel={`${choice.title}. ${choice.body}`}
            onPress={choice.onPress}>
            <Card>
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
          </Pressable>
        ))}
      </View>
    );
  }

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
          {subtitle !== undefined && <Text tone="muted">{subtitle}</Text>}
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

      {content}
    </Screen>
  );
}
