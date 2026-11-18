import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { EmptyDomain } from '../illustrations/empty-domain';
import { EmptyIllustration } from '../illustrations/empty-illustrations';
import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';
import { ZelligePattern } from './zellige-pattern';

export type EmptyStateProps = {
  /** Titre court (ex. « Aucune dépense »). */
  title: string;
  /** Explication ou prochaine étape. */
  description?: string;
  /**
   * Domaine de la liste vide : affiche son illustration sur un cercle à motif zellige (écran 4 de
   * docs/design-v2.png). Prioritaire sur `icon`.
   */
  domain?: EmptyDomain;
  /** Icône lucide affichée dans un cercle `primarySoft` (sans `domain`). */
  icon?: LucideIcon;
  /** Action proposée, en général un `Button`. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** État vide d'une liste ou d'un écran, centré, avec une action facultative. */
export function EmptyState({ title, description, domain, icon, action, style, testID }: EmptyStateProps) {
  const { colors, radius, spacing, sizes } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
        style,
      ]}>
      {domain !== undefined ? (
        <View
          testID={testID === undefined ? undefined : `${testID}-art`}
          style={{
            width: sizes.emptyCircle,
            height: sizes.emptyCircle,
            borderRadius: radius.pill,
            overflow: 'hidden',
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ZelligePattern />
          <EmptyIllustration domain={domain} size={sizes.emptyIllustration} />
        </View>
      ) : (
        icon !== undefined && (
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
        )
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
