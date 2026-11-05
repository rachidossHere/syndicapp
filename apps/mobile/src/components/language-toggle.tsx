// Bouton temporaire (plan 02) pour basculer entre français et arabe.
// Sera remplacé par le composant Button à l'étape 4.
import { Text, useTheme } from '@syndic/ui';
import { Pressable } from 'react-native';

import { useLanguage } from '@/providers/language-provider';

export function LanguageToggle() {
  const { colors, radius, spacing, sizes } = useTheme();
  const { language, setLanguage } = useLanguage();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={language === 'fr' ? 'Passer en arabe' : 'التبديل إلى الفرنسية'}
      onPress={() => void setLanguage(language === 'fr' ? 'ar' : 'fr')}
      style={({ pressed }) => ({
        minHeight: sizes.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.primaryPressed : colors.primary,
      })}>
      <Text variant="bodyStrong" tone="inverse">
        FR / عربي
      </Text>
    </Pressable>
  );
}
