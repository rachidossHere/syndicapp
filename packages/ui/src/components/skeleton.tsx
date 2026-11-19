import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEaseInOut } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { useTheme } from '../theme/theme-provider';

export type SkeletonProps = {
  /** Largeur : un nombre de px ou un pourcentage. Par défaut : toute la largeur. */
  width?: DimensionValue;
  /** Hauteur en px. Par défaut : 16. */
  height?: number;
  /** Rayon des coins : `radius` du thème. Par défaut : `md`. */
  rounded?: 'sm' | 'md' | 'lg' | 'pill';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Bloc gris qui tient la place d'un contenu en cours de chargement. Son opacité pulse doucement
 * (animation CSS de Reanimated, sur le fil d'interface, courbe `inOut`) ; fixe quand « Réduire les
 * animations » est activé. Masqué aux lecteurs d'écran : c'est l'écran qui annonce le chargement.
 */
export function Skeleton({ width = '100%', height = 16, rounded = 'md', style, testID }: SkeletonProps) {
  const { colors, radius, motion } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[
        {
          width,
          height,
          borderRadius: radius[rounded],
          borderCurve: 'continuous',
          backgroundColor: colors.border,
        },
        reducedMotion
          ? null
          : {
              animationName: { from: { opacity: 1 }, to: { opacity: motion.pulseMinOpacity } },
              animationDuration: motion.duration.pulse,
              animationTimingFunction: cssEaseInOut,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
            },
        style,
      ]}
    />
  );
}
