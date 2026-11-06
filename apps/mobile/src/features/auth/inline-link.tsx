import { Text, useTheme } from '@syndic/ui';
import { Pressable, View } from 'react-native';

/**
 * Ligne « Déjà un compte ? Se connecter » : question en texte atténué, lien en `primary`.
 * Toute la ligne est appuyable (zone tactile ≥ 44 px) et annoncée comme un lien.
 */
export function InlineLink({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  const { spacing, sizes } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${question} ${action}`}
      style={{ minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs }}>
        <Text tone="muted">{question}</Text>
        <Text variant="bodyStrong" tone="primary">
          {action}
        </Text>
      </View>
    </Pressable>
  );
}
