import { AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';
import { Screen, Text, useTheme } from '@syndic/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useT } from '@/i18n/use-t';
import { currentNetworkErrorKey } from '@/lib/network';

/**
 * Au démarrage, la session n'a pas pu être lue : le serveur est injoignable ou le téléphone
 * n'a pas de connexion. Message traduit et bouton « Réessayer ».
 */
export function StartupErrorScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { spacing } = useTheme();
  const t = useT();
  const [errorKey, setErrorKey] = useState<AuthErrorKey>(AUTH_ERROR_KEYS.network);

  // Distingue « pas de connexion » de « serveur injoignable » (expo-network).
  useEffect(() => {
    let active = true;
    void currentNetworkErrorKey().then((key) => {
      if (active) setErrorKey(key);
    });
    return () => {
      active = false;
    };
  }, [retrying]);

  return (
    <Screen contentStyle={{ justifyContent: 'center' }}>
      <View style={{ gap: spacing.lg }}>
        <Text variant="h2">{t('welcome.appName')}</Text>
        <ErrorNotice errorKey={errorKey} onRetry={onRetry} retrying={retrying} />
      </View>
    </Screen>
  );
}
