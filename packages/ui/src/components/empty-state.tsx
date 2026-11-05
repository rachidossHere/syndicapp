import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type EmptyStateProps = {
  /** Titre court (ex. « Aucune dépense »). */
  title: string;
  /** Explication ou prochaine étape. */
  description?: string;
  /** Icône lucide affichée dans un cercle `primarySoft`. */
  icon?: LucideIcon;
  /** Action proposée, en général un `Button`. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** État vide d'une liste ou d'un écran, centré, avec une action facultative. */
export function EmptyState({ title, description, icon, action, style, testID }: EmptyStateProps) {
  const { colors, radius, spacing, sizes } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
        style,
      ]}>
      {icon !== undefined && (
        <View
          style={{
            width: sizes.iconBox,
            height: sizes.iconBox,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={icon} color={colors.primary} />
        </View>
      )}
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description !== undefined && (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}
