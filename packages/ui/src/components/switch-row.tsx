import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type SwitchRowProps = {
  /** Intitulé (déjà traduit), aussi lu par les lecteurs d'écran. */
  label: string;
  /** Explication sous l'intitulé (déjà traduite). */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Interrupteur dans une ligne encadrée : intitulé, explication et interrupteur à la fin (inversé en
 * arabe). Toute la ligne est appuyable (44 px au moins) ; l'état est annoncé (`checked`) et se lit
 * aussi à la position de l'interrupteur, pas à sa couleur seule.
 */
export function SwitchRow({ label, description, value, onValueChange, disabled = false, style, testID }: SwitchRowProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={description === undefined ? label : `${label}. ${description}`}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID}
      style={[
        {
          minHeight: sizes.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          borderWidth: borderWidth.thin,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">{label}</Text>
        {description !== undefined && (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        )}
      </View>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch
          value={value}
          disabled={disabled}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.borderStrong}
        />
      </View>
    </Pressable>
  );
}
