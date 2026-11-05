import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Élément au début de la ligne (ex. `Avatar`). */
  leading?: ReactNode;
  /** Élément à la fin de la ligne (ex. `StatusBadge`, `Amount`). */
  trailing?: ReactNode;
  /** Rend la ligne appuyable (rôle « button ») et affiche un chevron, inversé en arabe. */
  onPress?: (event: GestureResponderEvent) => void;
  /** Libellé lu par les lecteurs d'écran (par défaut : titre et sous-titre). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Ligne de liste : titre, sous-titre, éléments au début et à la fin. */
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: ListItemProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();

  const base: ViewStyle = {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  };

  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle !== undefined && (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {onPress !== undefined && <Icon icon={ChevronRight} color={colors.iconInactive} flipInRtl />}
    </>
  );

  if (onPress === undefined) {
    return (
      <View style={[base, style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      testID={testID}
      style={({ pressed }) => [
        base,
        pressed && { backgroundColor: colors.bg, borderColor: colors.borderStrong },
        style,
      ]}>
      {content}
    </Pressable>
  );
}
