import { Screen, Text, useTheme } from '@syndic/ui';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n/use-t';

/** Affiché tant que la session n'est pas connue (lecture de SecureStore puis du serveur). */
export function LoadingScreen() {
  const { colors, spacing } = useTheme();
  const t = useT();

  return (
    <Screen contentStyle={{ justifyContent: 'center', alignItems: 'center' }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        style={{ alignItems: 'center', gap: spacing.md }}>
        <ActivityIndicator color={colors.primary} />
        <Text tone="muted">{t('common.loading')}</Text>
      </View>
    </Screen>
  );
}
