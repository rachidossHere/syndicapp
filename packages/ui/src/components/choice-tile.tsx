import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type ChoiceTileProps = {
  /** Texte de la tuile (ex. référence d'un appartement « A21 »), aussi lu par les lecteurs d'écran. */
  label: string;
  /** Tuile choisie : fond `primarySoft`, bordure et texte `primary`. */
  selected?: boolean;
  onPress: () => void;
  /** Remplace le libellé lu (ex. « A21, reste 450 MAD »). */
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Mise en page (largeur dans une grille). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Tuile de choix dans une grille (écran « Encaisser » : qui a payé ?).
 * Comme `Chip`, l'état choisi est annoncé et visible à la bordure et au fond.
 */
export function ChoiceTile({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: ChoiceTileProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: sizes.choiceTile,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: borderWidth.thin,
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: selected ? colors.primarySoft : pressed ? colors.bg : colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}>
      <Text variant="bodyStrong" tone={selected ? 'primary' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
