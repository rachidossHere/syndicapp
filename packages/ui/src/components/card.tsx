import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-provider';

export type CardProps = {
  children: ReactNode;
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
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const { colors, radius, spacing, borderWidth, sizes } = useTheme();

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.sm,
  };

  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        base,
        { minHeight: sizes.touchTarget },
        // État appuyé visible : fond sable et bordure plus marquée.
        pressed && { backgroundColor: colors.bg, borderColor: colors.borderStrong },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
