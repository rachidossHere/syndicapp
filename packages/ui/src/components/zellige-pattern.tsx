import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { zelligeGeometry } from './zellige-geometry';

export type ZelligePatternProps = {
  /** Couleur du trait. Par défaut `primary` ; `textInverse` sur un fond sombre (`tealDeep`). */
  color?: string;
  /** Opacité du motif. Par défaut : `opacity.zellige` (10 %). */
  opacity?: number;
  /** Côté de la cellule répétée, en px. Par défaut : `sizes.zelligeCell`. */
  cellSize?: number;
  /** Mise en page (le motif remplit son parent par défaut). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Motif zellige répétable, en SVG, posé en fond d'une carte ou d'un en-tête : il remplit son
 * parent (qui doit avoir `overflow: 'hidden'` s'il a des coins arrondis) et ne reçoit jamais le
 * toucher. Décoratif : masqué aux lecteurs d'écran. Statique : la vue est mise en bitmap
 * (`shouldRasterizeIOS`, `renderToHardwareTextureAndroid`), donc sans coût au défilement.
 */
export function ZelligePattern({ color, opacity, cellSize, style }: ZelligePatternProps) {
  const theme = useTheme();
  const geometry = zelligeGeometry(cellSize ?? theme.sizes.zelligeCell);
  // `useId` contient des « : » : interdits dans une référence `url(#…)`.
  const patternId = `zellige-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stroke = color ?? theme.colors.primary;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
      style={[StyleSheet.absoluteFill, { opacity: opacity ?? theme.opacity.zellige }, style]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={geometry.cell}
            height={geometry.cell}
          >
            <Path
              d={geometry.square}
              fill="none"
              stroke={stroke}
              strokeWidth={geometry.strokeWidth}
            />
            <Path
              d={geometry.diamond}
              fill="none"
              stroke={stroke}
              strokeWidth={geometry.strokeWidth}
            />
            {geometry.corners.map((corner) => (
              <Circle
                key={`${corner.cx}-${corner.cy}`}
                cx={corner.cx}
                cy={corner.cy}
                r={corner.r}
                fill="none"
                stroke={stroke}
                strokeWidth={geometry.strokeWidth}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}
