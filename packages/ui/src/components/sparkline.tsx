import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { sparklineGeometry } from './sparkline-geometry';

export type SparklineProps = {
  /** Valeurs de la plus ancienne à la plus récente. Moins de 3 valeurs : rien n'est affiché. */
  values: readonly number[];
  /** Largeur et hauteur du dessin, en px. Par défaut : 88 × 40. */
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Marge intérieure du trait, en px. */
const PADDING = 2;

/**
 * Petite courbe décorative (écran 1 de docs/design-v2.png) : trait `primary` et remplissage léger.
 * Elle n'ajoute aucune information absente du texte à côté : masquée aux lecteurs d'écran. Le sens
 * du temps (gauche → droite) est le même en arabe : une courbe n'est pas du texte.
 */
export function Sparkline({ values, width = 88, height = 40, style, testID }: SparklineProps) {
  const { colors, opacity, sizes } = useTheme();
  const geometry = sparklineGeometry(values, width, height, PADDING);
  if (geometry === null) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[{ width, height, direction: 'ltr' }, style]}>
      <Svg width={width} height={height}>
        <Path d={geometry.area} fill={colors.primary} fillOpacity={opacity.duotoneFill} />
        <Polyline
          points={geometry.line}
          fill="none"
          stroke={colors.primary}
          strokeWidth={sizes.iconStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
