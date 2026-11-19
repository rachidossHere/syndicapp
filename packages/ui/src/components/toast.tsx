import Check from 'lucide-react-native/icons/check';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { fadeOutFast, riseIn } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
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

// Construits une fois, hors du composant.
const TOAST_ENTERING = riseIn();

/**
 * Confirmation : fond `successBg`, texte `successFg`, icône de validation.
 * Annoncé aux lecteurs d'écran dès son affichage.
 *
 * Il entre par fondu et léger glissement depuis le bas, et disparaît par fondu (plus court). Un
 * toucher le ferme tout de suite. « Réduire les animations » activé : il apparaît et disparaît sans
 * mouvement.
 */
export function Toast({ message, style, testID }: ToastProps) {
  const { colors, radius, spacing, sizes } = useTheme();
  const reducedMotion = useReducedMotion();
  // Le message fermé par un toucher : un nouveau message s'affiche de nouveau.
  const [dismissed, setDismissed] = useState<string | undefined>();

  // iOS ne lit pas les zones « live » : annonce explicite à l'affichage et à chaque nouveau message.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (dismissed === message) return null;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : TOAST_ENTERING}
      exiting={reducedMotion ? undefined : fadeOutFast}
      testID={testID}
      style={style}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
        onPress={() => setDismissed(message)}
        style={{
          minHeight: sizes.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.successBg,
        }}>
        <Icon icon={Check} color={colors.successFg} />
        <Text variant="bodyStrong" tone="success" style={{ flex: 1 }}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
