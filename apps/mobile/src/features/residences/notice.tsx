import { Icon, Text, useTheme, type IconComponent } from '@syndic/ui';
import { View } from 'react-native';

/** Encadré d'information avec icône (écran 1 de docs/residences.png : « Vous serez le seul syndic »). */
export function Notice({ icon, message }: { icon: IconComponent; message: string }) {
  const { colors, radius, spacing, sizes } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.primarySoft,
      }}>
      <View
        style={{
          width: sizes.iconBox,
          height: sizes.iconBox,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon icon={icon} color={colors.textInverse} />
      </View>
      <Text variant="bodyStrong" tone="primary" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
