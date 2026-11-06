// Pastille « FR · عربي » (docs/auth.png) : bascule entre français et arabe.
import { Text, useTheme } from '@syndic/ui';
import { Pressable } from 'react-native';

import { useT } from '@/i18n/use-t';
import { useLanguage } from '@/providers/language-provider';

export function LanguageToggle() {
  const { colors, radius, spacing, borderWidth } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = useT();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.switchLanguage')}
      onPress={() => void setLanguage(language === 'fr' ? 'ar' : 'fr')}
      // La pastille est plus petite que 44 px : la zone tactile est agrandie autour d'elle.
      hitSlop={spacing.xs}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        borderWidth: borderWidth.thin,
        borderColor: colors.borderStrong,
        backgroundColor: pressed ? colors.bg : colors.surface,
      })}>
      <Text variant="bodyStrong">FR · عربي</Text>
    </Pressable>
  );
}
