// Écran 4 de docs/auth.png : « Bonjour {prénom} » après connexion ou inscription.
// Sans résidence : deux choix (créer, rejoindre). Avec une résidence : accueil provisoire (plan 04),
// dont les entrées dépendent du rôle (l'API refuse de toute façon ce que le rôle ne permet pas).
import { AUTH_ERROR_KEYS, can, type AuthErrorKey } from '@syndic/shared';
import { Banner, Button, Card, Chip, Icon, ListItem, Screen, Text, Toast, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Flag from 'lucide-react-native/icons/flag';
import KeyRound from 'lucide-react-native/icons/key-round';
import Plus from 'lucide-react-native/icons/plus';
import Receipt from 'lucide-react-native/icons/receipt';
import Wallet from 'lucide-react-native/icons/wallet';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { canSeeAccounts } from '@/lib/cash';
import { canUseIssues } from '@/lib/issues';
import { canManageCharges, myDuesResidenceId } from '@/features/charges/access';
import { MyChargesSummary } from '@/features/charges/my-charges-summary';
import { useRoleLabel } from '@/features/residences/use-role-label';
import { useMyDues } from '@/hooks/use-charges';
import { useMe } from '@/hooks/use-me';
import { useActiveResidence } from '@/hooks/use-residences';
import { useSession } from '@/hooks/use-session';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
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
  // Mes charges : requête faite uniquement pour un copropriétaire (jamais pour un locataire ou un gardien).
  const myDues = useMyDues(myDuesResidenceId(active));
  const [showWelcome, setShowWelcome] = useState(consumeJustSignedUp);
  // Confirmation laissée par un écran qui vient de se fermer (« Dépense enregistrée… »).
  const flash = useFlashMessage();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();
  const [meErrorKey, setMeErrorKey] = useState<AuthErrorKey>(AUTH_ERROR_KEYS.network);

  useEffect(() => {
    if (!showWelcome) return;
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_TOAST_MS);
    return () => clearTimeout(timer);
  }, [showWelcome]);

  useEffect(() => {
    if (flash === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), WELCOME_TOAST_MS);
    return () => clearTimeout(timer);
  }, [flash]);

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
        {/* Copropriétaire : la carte « Mes charges » est le contenu principal de l'accueil. */}
        {active.role === 'owner' && <MyChargesSummary residenceId={active.id} />}
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
                <Icon icon={Building} color={colors.primary} />
              </View>
            }
            onPress={() => router.push('/lots')}
          />
        )}
        {/* Charges : syndic et trésorier (lecture des comptes, et encaissement ou lancement d'appels). */}
        {canManageCharges(active.role) && (
          <ListItem
            title={t('home.charges')}
            subtitle={t('home.chargesBody')}
            leading={
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.successBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={Wallet} color={colors.successFg} />
              </View>
            }
            onPress={() => router.push('/charges')}
          />
        )}
        {/* Comptes : rôles avec accounts.read (syndic, trésorier, adjoint, copropriétaire). Ni locataire ni gardien. */}
        {canSeeAccounts(active.role) && (
          <ListItem
            title={t('home.accounts')}
            subtitle={t('home.accountsBody')}
            leading={
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.infoBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={ChartColumn} color={colors.infoFg} />
              </View>
            }
            onPress={() => router.push('/accounts')}
          />
        )}
        {/* Dépenses : syndic et trésorier (expenses.write). L'API refuse de toute façon les autres rôles. */}
        {can(active.role, 'expenses.write') && (
          <ListItem
            title={t('home.addExpense')}
            subtitle={t('home.addExpenseBody')}
            leading={
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.warningBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={Receipt} color={colors.warningFg} />
              </View>
            }
            onPress={() => router.push('/add-expense')}
          />
        )}
        {/* Signalements : tous les rôles qui ont issues.write (gardien et locataire compris). */}
        {canUseIssues(active.role) && (
          <ListItem
            title={t('home.issues')}
            subtitle={t('home.issuesBody')}
            leading={
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.dangerBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={Flag} color={colors.dangerFg} />
              </View>
            }
            onPress={() => router.push('/issues')}
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
      onRefresh={active?.role === 'owner' ? () => void myDues.refetch() : undefined}
      refreshing={myDues.isRefetching}
      footer={
        <>
          {signOutError !== undefined && <ErrorNotice errorKey={signOutError} />}
          <Button variant="ghost" label={t('home.signOut')} loading={signingOut} onPress={() => void onSignOut()} />
        </>
      }>
      {showWelcome && <Toast message={t('home.welcomeToast')} />}
      {flash !== undefined && <Toast message={t(flash)} />}

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
