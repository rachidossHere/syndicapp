import type { LucideIcon } from 'lucide-react-native';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme/theme-provider';
import type { Domain } from '../tokens/domains';
import type { StatusTone } from '../tokens/status';
import { Icon } from './icon';
import { PressableSurface } from './pressable-surface';
import { Text } from './text';

export type ActionTileTone = 'primary' | StatusTone;

export type ActionTileProps = {
  /** Libellé de l'action (ex. « Encaisser une charge »). */
  label: string;
  icon: LucideIcon;
  onPress: (event: GestureResponderEvent) => void;
  /** Couleur du carré de l'icône. Par défaut : `primary`. */
  tone?: ActionTileTone;
  /** Domaine (charges, signalements…) : pastille duotone teintée de la maquette v2. Prioritaire sur `tone`. */
  domain?: Domain;
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
  domain,
  accessibilityHint,
  style,
  testID,
}: ActionTileProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const box = toneColors(tone, colors);

  return (
    <PressableSurface
      feedback="scale"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      pressedStyle={{ backgroundColor: colors.bg, borderColor: colors.borderStrong }}
      style={[
        {
          minHeight: sizes.actionTileMinHeight,
          justifyContent: 'space-between',
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: borderWidth.thin,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
        },
        style,
      ]}>
      {domain !== undefined ? (
        <Icon icon={icon} variant="tile" domain={domain} tileSize="sm" />
      ) : (
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
      )}
      <Text variant="bodyStrong">{label}</Text>
    </PressableSurface>
  );
}
