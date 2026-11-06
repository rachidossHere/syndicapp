import { useTheme } from '@syndic/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

/** Pile racine : l'accueil, et par-dessus les écrans réservés au développement. */
function RootStack() {
  const { colors, typography, fontFamily } = useTheme();

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
      {/* L'écran gère lui-même sa zone sûre (composant Screen) : pas d'en-tête. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Inaccessible hors du mode développement, y compris par lien profond. */}
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev/design-system" options={{ title: 'Design system' }} />
        <Stack.Screen name="dev/auth-test" options={{ title: 'Test d’authentification' }} />
      </Stack.Protected>
    </Stack>
  );
}
