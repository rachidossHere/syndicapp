import { Banner, Button, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';

type FallbackQuery = { error: unknown; isFetching: boolean; refetch: () => unknown };

/**
 * Contenu d'un écran tant que ses données ne sont pas là : « Chargement… », ou l'erreur avec
 * « Réessayer » (serveur injoignable : message réseau et adresse de l'API en développement).
 * Jamais d'état vide pendant le premier chargement.
 */
export function QueryFallback({ query, message }: { query: FallbackQuery; message: string }) {
  const { spacing } = useTheme();
  const t = useT();
  if (query.error === null || query.error === undefined) {
    return <Text tone="muted">{t('common.loading')}</Text>;
  }
  const retry = () => void query.refetch();
  if (query.error instanceof ApiError && query.error.status === 0) {
    return <ErrorNotice errorKey={apiErrorKey(query.error)} onRetry={retry} retrying={query.isFetching} />;
  }
  return (
    <View style={{ gap: spacing.md }}>
      <Banner message={message} />
      <Button variant="secondary" label={t('common.retry')} loading={query.isFetching} onPress={retry} />
    </View>
  );
}
