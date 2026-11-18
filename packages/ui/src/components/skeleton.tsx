import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

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
 * Bloc gris qui tient la place d'un contenu en cours de chargement (squelette simple, sans animation :
 * les animations de chargement viennent à l'étape 4 du plan 02b). Masqué aux lecteurs d'écran : c'est
 * l'écran qui annonce le chargement.
 */
export function Skeleton({ width = '100%', height = 16, rounded = 'md', style, testID }: SkeletonProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[{ width, height, borderRadius: radius[rounded], borderCurve: 'continuous', backgroundColor: colors.border }, style]}
    />
  );
}
