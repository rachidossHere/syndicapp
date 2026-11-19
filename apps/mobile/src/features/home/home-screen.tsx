// Accueil (onglet « Accueil », plan 02b, étape 3). Sans résidence : deux choix (créer, rejoindre).
// Avec une résidence : l'accueil de gestion (syndic, trésorier, adjoint : écran 1 de
// docs/design-v2.png) ou l'accueil de l'habitant (copropriétaire, locataire, gardien : écran 2).
// Les réglages de la personne (notifications, langue, résidence, déconnexion) sont dans l'onglet Profil.
// Quatre états : chargement (squelettes), erreur (avec « Réessayer »), vide (sans résidence), contenu.
import { AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';
import { Banner, Button, Screen, Skeleton, Toast, useTheme } from '@syndic/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useMe } from '@/hooks/use-me';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
import { homeKindFor } from '@/lib/home';
import { currentNetworkErrorKey } from '@/lib/network';
import { consumeJustSignedUp } from '@/lib/welcome-flag';

import { HomeHeader, HomeHeaderSkeleton, useTodayLabel } from './home-header';
import { NoResidenceChoices } from './no-residence-choices';
import { ResidentHome } from './resident-home';
import { StaffHome } from './staff-home';
import { useRefreshHome } from './use-refresh-home';

/** Durée d'affichage du toast de bienvenue, en millisecondes. */
const WELCOME_TOAST_MS = 4000;

export function HomeScreen() {
  const { spacing, layout } = useTheme();
  const t = useT();
  const today = useTodayLabel();
  const me = useMe(true);
  const { active, query: residencesQuery } = useActiveResidence();
  const { refresh, refreshing } = useRefreshHome(active?.id);
  const [showWelcome, setShowWelcome] = useState(consumeJustSignedUp);
  // Confirmation laissée par un écran qui vient de se fermer (« Dépense enregistrée… »).
  const flash = useFlashMessage();
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

  let body;
  if (me.data === undefined) {
    // Profil de la personne pas encore là : erreur avec « Réessayer », sinon squelettes.
    body = me.error ? (
      meNetworkFailure ? (
        <ErrorNotice errorKey={meErrorKey} onRetry={() => void me.refetch()} retrying={me.isFetching} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Banner message={t('home.loadError')} />
          <Button variant="secondary" label={t('common.retry')} loading={me.isFetching} onPress={() => void me.refetch()} />
        </View>
      )
    ) : (
      <HomeSkeleton />
    );
  } else if (residencesQuery.data === undefined) {
    body = residencesQuery.error ? (
      <ErrorNotice
        errorKey={apiErrorKey(residencesQuery.error)}
        onRetry={() => void residencesQuery.refetch()}
        retrying={residencesQuery.isFetching}
      />
    ) : (
      <HomeSkeleton />
    );
  } else if (active !== null) {
    body = (
      <View style={{ gap: layout.sectionGap }}>
        {homeKindFor(active.role) === 'staff' ? (
          <StaffHome name={me.data.name} residence={active} />
        ) : (
          <ResidentHome name={me.data.name} residence={active} />
        )}
        {/* Un refus d'actualisation de la liste garde l'accueil affiché, avec un message. */}
        {residencesQuery.error && <Banner message={t('home.residenceError')} />}
      </View>
    );
  } else {
    body = (
      <View style={{ gap: layout.sectionGap }}>
        <HomeHeader name={me.data.name} caption={today} />
        <NoResidenceChoices />
      </View>
    );
  }

  return (
    <Screen scroll onRefresh={active !== null ? () => void refresh() : undefined} refreshing={refreshing}>
      {showWelcome && <Toast message={t('home.welcomeToast')} />}
      {flash !== undefined && <Toast message={t(flash)} />}
      {body}
    </Screen>
  );
}

/** Squelette de l'accueil : en-tête et deux blocs, sans animation (étape 4 du plan 02b). */
function HomeSkeleton() {
  const { layout, sizes } = useTheme();
  return (
    <View style={{ gap: layout.sectionGap }}>
      <HomeHeaderSkeleton />
      <Skeleton height={sizes.residenceHeroMinHeight} rounded="lg" />
      <Skeleton height={sizes.actionTileMinHeight} rounded="lg" />
    </View>
  );
}
