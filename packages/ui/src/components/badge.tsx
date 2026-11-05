import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { statuses, type BusinessStatus, type StatusTone } from '../tokens/status';
import { Text } from './text';

export type BadgeProps = {
  /** Libellé affiché : un état n'est jamais signalé par la couleur seule. */
  label: string;
  /** Ton : paire de couleurs `<ton>Bg` / `<ton>Fg`. Par défaut : `info`. */
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Pastille en forme de gélule, texte `caption`. */
export function Badge({ label, tone = 'info', style, testID }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      testID={testID}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.pill,
          backgroundColor: colors[`${tone}Bg`],
        },
        style,
      ]}>
      <Text variant="caption" style={{ color: colors[`${tone}Fg`] }}>
        {label}
      </Text>
    </View>
  );
}

export type StatusBadgeProps = {
  /** Statut métier (`paid`, `unpaid`, `open`, `in_progress`, `resolved`). */
  status: BusinessStatus;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Badge d'un statut métier : ton et libellé (FR ou AR) viennent de `status.ts`. */
export function StatusBadge({ status, style, testID }: StatusBadgeProps) {
  const { t } = useTheme();
  const definition = statuses[status];

  return <Badge label={t(definition.labelKey)} tone={definition.tone} style={style} testID={testID} />;
}
