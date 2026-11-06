// Message d'erreur d'un formulaire ou d'un chargement : bandeau traduit, et en développement
// seulement, l'adresse de l'API utilisée (pour repérer tout de suite une adresse périmée).
import { AUTH_ERROR_KEYS } from '@syndic/shared';
import { Banner, Button, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { API_URL } from '@/lib/config';

const NETWORK_KEYS: readonly string[] = [AUTH_ERROR_KEYS.network, AUTH_ERROR_KEYS.offline];

export type ErrorNoticeProps = {
  /** Clé de traduction de l'erreur (auth.errors.*). */
  errorKey: string;
  /** Affiche un bouton « Réessayer ». */
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorNotice({ errorKey, onRetry, retrying = false }: ErrorNoticeProps) {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const isNetwork = NETWORK_KEYS.includes(errorKey);

  return (
    <View style={{ gap: spacing.sm }}>
      <Banner message={errorText(errorKey) ?? t('auth.errors.unknown')} />
      {__DEV__ && isNetwork && (
        <Text variant="small" tone="muted" selectable>
          {t('dev.apiUrl', { url: API_URL })}
        </Text>
      )}
      {onRetry !== undefined && (
        <Button variant="secondary" label={t('common.retry')} loading={retrying} onPress={onRetry} />
      )}
    </View>
  );
}
