import Check from 'lucide-react-native/icons/check';
import { useEffect } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type ToastProps = {
  /** Message de confirmation (ex. « Paiement enregistré »). */
  message: string;
  /** Mise en page (position, marges) : l'emplacement et la durée sont gérés par l'écran. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Confirmation : fond `successBg`, texte `successFg`, icône de validation.
 * Annoncé aux lecteurs d'écran dès son affichage.
 */
export function Toast({ message, style, testID }: ToastProps) {
  const { colors, radius, spacing } = useTheme();

  // iOS ne lit pas les zones « live » : annonce explicite à l'affichage et à chaque nouveau message.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.successBg,
        },
        style,
      ]}>
      <Icon icon={Check} color={colors.successFg} />
      <Text variant="bodyStrong" tone="success" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
