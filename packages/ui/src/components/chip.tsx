import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type ChipProps = {
  /** Texte de la puce, aussi lu par les lecteurs d'écran. */
  label: string;
  /** Puce choisie : fond `primarySoft`, bordure et texte `primary`. */
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Puce de choix (rôle, filtre, bâtiment) : gélule de 44 px de haut au moins.
 * L'état choisi est annoncé (`selected`) et se voit à la bordure et au fond, pas à la couleur seule
 * du texte.
 */
export function Chip({ label, selected = false, onPress, disabled = false, style, testID }: ChipProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: sizes.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
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
