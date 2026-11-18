import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type GradientFillProps = {
  /** Couleur de départ (haut) et d'arrivée (bas). Jetons du thème. */
  from: string;
  to: string;
  /** Opacités de départ et d'arrivée (fondu vers le fond : `to` à 0). Par défaut 1. */
  fromOpacity?: number;
  toOpacity?: number;
  /** `vertical` : de haut en bas. `diagonal` : du coin haut au coin bas opposé. */
  direction?: 'vertical' | 'diagonal';
  style?: StyleProp<ViewStyle>;
};

/**
 * Dégradé linéaire qui remplit son parent (en SVG : aucune dépendance de plus). Décoratif et sans
 * toucher. Le dégradé vertical ne dépend pas du sens d'écriture ; le diagonal est un habillage.
 */
export function GradientFill({
  from,
  to,
  fromOpacity = 1,
  toOpacity = 1,
  direction = 'vertical',
  style,
}: GradientFillProps) {
  const id = `gradient-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={direction === 'diagonal' ? '1' : '0'} y2="1">
            <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
            <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
