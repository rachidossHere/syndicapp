import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type SegmentedControlOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Choix exclusif entre 2 ou 3 vues (ex. « Génération rapide » / « Un par un »). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  testID,
}: SegmentedControlProps<T>) {
  const { colors, radius, spacing, sizes } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          padding: spacing.xs,
          gap: spacing.xs,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.border,
        },
        style,
      ]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: sizes.touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              backgroundColor: selected ? colors.surface : 'transparent',
            }}>
            <Text variant="bodyStrong" tone={selected ? 'default' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
