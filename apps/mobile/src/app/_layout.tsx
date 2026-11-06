import { useTheme } from '@syndic/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { LoadingScreen } from '@/features/auth/loading-screen';
import { useSession } from '@/hooks/use-session';
import { useT } from '@/i18n/use-t';
import { fontSources } from '@/lib/fonts';
import { queryClient } from '@/lib/query-client';
import { LanguageProvider } from '@/providers/language-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontSources);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) {
      console.error('[fonts] chargement des polices impossible :', fontError);
    }
  }, [fontError]);

  // L'écran de démarrage reste affiché tant que les polices ne sont pas prêtes.
  // En cas d'erreur, l'appli s'ouvre quand même avec la police système.
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {/* Thème clair uniquement (MVP) : texte sombre dans la barre d'état. */}
        <StatusBar style="dark" />
        <RootStack />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

/**
 * Pile racine et navigation protégée :
 * - tant que la session est inconnue (premier chargement), écran de chargement ;
 * - avec une session, seul le groupe (app) est accessible ; sans session, seul (auth).
 * Quand la session change (connexion, déconnexion), Expo Router bascule vers le groupe accessible
 * et retire l'autre de l'historique : impossible de revenir à « Bonjour » après la déconnexion.
 */
function RootStack() {
  const { colors, typography, fontFamily } = useTheme();
  const { user, isLoading } = useSession();
  const t = useT();
  const [sessionKnown, setSessionKnown] = useState(false);

  // Une fois la session connue, on ne revient plus à l'écran de chargement : une simple
  // actualisation de la session ne doit pas démonter les formulaires en cours.
  useEffect(() => {
    if (!isLoading) setSessionKnown(true);
  }, [isLoading]);

  if (!sessionKnown) {
    return <LoadingScreen />;
  }

  const signedIn = user !== null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          color: colors.text,
          fontFamily: fontFamily(typography.h3.fontWeight),
          fontSize: typography.h3.fontSize,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      {/* Les écrans gèrent eux-mêmes leur zone sûre (composant Screen) : pas d'en-tête. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Inaccessible hors du mode développement, y compris par lien profond. */}
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev/design-system" options={{ title: t('dev.designSystem') }} />
      </Stack.Protected>
    </Stack>
  );
}
