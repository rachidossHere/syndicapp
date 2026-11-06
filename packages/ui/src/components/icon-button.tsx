import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Libellé lu par les lecteurs d'écran (obligatoire : le bouton n'a pas de texte). */
  accessibilityLabel: string;
  onPress: (event: GestureResponderEvent) => void;
  /** Inverse l'icône en arabe (flèche de retour, chevron). */
  flipInRtl?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Bouton rond avec une icône seule (ex. retour) : 44 px, fond `surface`, bordure `border`. */
export function IconButton({ icon, accessibilityLabel, onPress, flipInRtl, style, testID }: IconButtonProps) {
  const { colors, radius, sizes, borderWidth } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        {
          width: sizes.touchTarget,
          height: sizes.touchTarget,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.bg : colors.surface,
          borderWidth: borderWidth.thin,
          borderColor: pressed ? colors.borderStrong : colors.border,
        },
        style,
      ]}>
      <Icon icon={icon} color={colors.text} flipInRtl={flipInRtl} />
    </Pressable>
  );
}
