import type { LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Theme } from '../theme/theme-provider';
import type { StatusTone } from '../tokens/status';
import { Icon } from './icon';
import { Text } from './text';

export type ActionTileTone = 'primary' | StatusTone;

export type ActionTileProps = {
  /** Libellé de l'action (ex. « Encaisser une charge »). */
  label: string;
  icon: LucideIcon;
  onPress: (event: GestureResponderEvent) => void;
  /** Couleur du carré de l'icône. Par défaut : `primary`. */
  tone?: ActionTileTone;
  accessibilityHint?: string;
  /** Mise en page (ex. `flex: 1` dans une grille). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function toneColors(tone: ActionTileTone, colors: Theme['colors']) {
  return tone === 'primary'
    ? { background: colors.primarySoft, foreground: colors.primary }
    : { background: colors[`${tone}Bg`], foreground: colors[`${tone}Fg`] };
}

/** Grande tuile d'action de l'accueil syndic : icône dans un carré coloré, libellé dessous. */
export function ActionTile({
  label,
  icon,
  onPress,
  tone = 'primary',
  accessibilityHint,
  style,
  testID,
}: ActionTileProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const box = toneColors(tone, colors);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: sizes.actionTileMinHeight,
          justifyContent: 'space-between',
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: pressed ? colors.bg : colors.surface,
          borderColor: pressed ? colors.borderStrong : colors.border,
          borderWidth: borderWidth.thin,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
        },
        style,
      ]}>
      <View
        style={{
          width: sizes.iconBox,
          height: sizes.iconBox,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: box.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon icon={icon} color={box.foreground} />
      </View>
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}
