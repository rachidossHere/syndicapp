import { Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

/** Carré de repère en début de ligne : référence d'appartement (« A12 ») ou période (« T4 »). */
export function ReferenceBox({ label }: { label: string }) {
  const { colors, radius, spacing, sizes } = useTheme();
  return (
    <View
      style={{
        minWidth: sizes.iconBox,
        height: sizes.iconBox,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="bodyStrong" tone="primary">
        {label}
      </Text>
    </View>
  );
}
