import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { CATEGORY_ART, type CategoryArtCategory } from './category-art-spec';
import { GradientFill } from './gradient-fill';

export type CategoryArtProps = {
  category: CategoryArtCategory;
  /** Côté du pictogramme en px. Par défaut : `sizes.categoryGlyph`. */
  glyphSize?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Illustration d'une catégorie d'annonce (travaux, assemblée, info, urgent) : dégradé et
 * pictogramme centré. Elle remplit son parent (bande d'une carte, bandeau de l'accueil), qui doit
 * avoir `overflow: 'hidden'`. Décorative : la catégorie est toujours écrite à côté (badge).
 */
export function CategoryArt({ category, glyphSize, style, testID }: CategoryArtProps) {
  const { colors, sizes } = useTheme();
  const spec = CATEGORY_ART[category];
  const side = glyphSize ?? sizes.categoryGlyph;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <GradientFill from={colors[spec.from]} to={colors[spec.to]} direction="diagonal" />
      <Svg width={side} height={side} viewBox="0 0 24 24">
        {spec.paths.map((d) => (
          <Path
            key={d}
            d={d}
            fill="none"
            stroke={colors.textInverse}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {spec.dots.map(([cx, cy, r]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={colors.textInverse} />
        ))}
      </Svg>
    </View>
  );
}
