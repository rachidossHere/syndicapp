// En-tête des accueils (écrans 1 et 2 de docs/design-v2.png) : ligne de contexte (la date pour le
// syndic, la résidence et l'appartement pour l'habitant), « Bonjour {prénom} » et avatar avec l'initiale.
import { Avatar, Skeleton, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { firstName, todayParts } from '@/lib/home';

/** « Mercredi 18 novembre » (fuseau Africa/Casablanca), dans la langue active. */
export function useTodayLabel(): string {
  const t = useT();
  const { weekday, day, month } = todayParts();
  return t('home.date', {
    weekday: t(`home.weekday.${weekday}` as TranslationKey),
    day,
    month: t(`charges.dateMonths.${month}` as TranslationKey),
  });
}

export function HomeHeader({ name, caption }: { name: string; caption: string }) {
  const { spacing, sizes } = useTheme();
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="small" tone="muted">
          {caption}
        </Text>
        <Text variant="h2" accessibilityRole="header">
          {t('home.greeting', { name: firstName(name) })}
        </Text>
      </View>
      <Avatar name={name} single size={sizes.avatarLarge} />
    </View>
  );
}

/** Même mise en page pendant le chargement : « Chargement… » est annoncé, les blocs gris sont muets. */
export function HomeHeaderSkeleton() {
  const { spacing, sizes } = useTheme();
  const t = useT();
  return (
    <View
      accessible
      accessibilityLabel={t('common.loading')}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="40%" height={spacing.lg} />
        <Skeleton width="65%" height={spacing.xxxl} />
      </View>
      <Skeleton width={sizes.avatarLarge} height={sizes.avatarLarge} rounded="pill" />
    </View>
  );
}
