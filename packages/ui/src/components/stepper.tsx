import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Libellés lus par les lecteurs d'écran pour les boutons « − » et « + » (déjà traduits). */
  decreaseLabel: string;
  increaseLabel: string;
  /** Libellé du compteur, lu avec sa valeur (ex. « Appartements par étage »). */
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Compteur « − 3 + » : la valeur reste entre `min` et `max`. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  label,
  style,
  testID,
}: StepperProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();

  const button = (kind: 'minus' | 'plus') => {
    const disabled = kind === 'minus' ? value <= min : value >= max;
    return (
      <Pressable
        onPress={() => onChange(kind === 'minus' ? value - 1 : value + 1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={kind === 'minus' ? decreaseLabel : increaseLabel}
        accessibilityState={{ disabled }}
        style={{
          width: sizes.input,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
        }}>
        <Icon icon={kind === 'minus' ? Minus : Plus} color={colors.primary} />
      </Pressable>
    );
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && value < max) onChange(value + 1);
        if (event.nativeEvent.actionName === 'decrement' && value > min) onChange(value - 1);
      }}
      testID={testID}
      style={[
        {
          minHeight: sizes.input,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          borderWidth: borderWidth.thin,
          borderColor: colors.borderStrong,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}>
      {button('minus')}
      <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {button('plus')}
    </View>
  );
}
