import type { ReactNode } from 'react';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { PressableSurface } from './pressable-surface';

export type CardProps = {
  children: ReactNode;
  /** Carte mise en avant (annonce épinglée) : bordure `primary` de 2 px, sans changer le padding. */
  highlighted?: boolean;
  /**
   * Carte qui groupe des lignes pleine largeur (`ListItem plain`, séparées par des filets) : sans padding
   * ni espace entre les enfants, contenu rogné aux coins arrondis.
   */
  flush?: boolean;
  /** Rend la carte appuyable : Pressable avec état appuyé et rôle « button ». */
  onPress?: (event: GestureResponderEvent) => void;
  /** Libellé lu par les lecteurs d'écran quand la carte est appuyable. */
  accessibilityLabel?: string;
  /** Indication complémentaire lue après le libellé (ex. « Ouvre le détail »). */
  accessibilityHint?: string;
  /** Style de mise en page (fusionné en dernier) : marges, flex. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Carte : fond `surface`, bordure `border`, rayon `lg`, padding 16. */
export function Card({
  children,
  highlighted = false,
  flush = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const { colors, radius, spacing, borderWidth, sizes } = useTheme();

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: highlighted ? colors.primary : colors.border,
    borderWidth: highlighted ? borderWidth.strong : borderWidth.thin,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    // Bordure plus épaisse : le padding diminue d'autant, la carte garde la même taille de contenu.
    padding: highlighted ? spacing.lg - (borderWidth.strong - borderWidth.thin) : spacing.lg,
    gap: spacing.sm,
    ...(flush ? { padding: 0, gap: 0, overflow: 'hidden' as const } : {}),
  };

  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    );
  }

  // Carte appuyable : elle s'enfonce légèrement au toucher (échelle) et le fond sable et la bordure plus
  // marquée confirment l'appui, y compris quand « Réduire les animations » coupe l'échelle.
  return (
    <PressableSurface
      feedback="scale"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      pressedStyle={{
        backgroundColor: colors.bg,
        borderColor: highlighted ? colors.primaryPressed : colors.borderStrong,
      }}
      style={[base, { minHeight: sizes.touchTarget }, style]}>
      {children}
    </PressableSurface>
  );
}
