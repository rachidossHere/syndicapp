import CircleExclamationPoint from 'lucide-react-native/icons/circle-exclamation-point';
import Info from 'lucide-react-native/icons/info';
import { useEffect } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type BannerTone = 'danger' | 'info';

export type BannerProps = {
  /** Message affiché (déjà traduit). */
  message: string;
  /** `danger` : erreur (ex. identifiants incorrects). `info` : information. Par défaut : `danger`. */
  tone?: BannerTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Bandeau de message dans un écran (erreur générique d'un formulaire) : fond `<ton>Bg`,
 * texte `<ton>Fg`, icône. Annoncé aux lecteurs d'écran à son apparition.
 */
export function Banner({ message, tone = 'danger', style, testID }: BannerProps) {
  const { colors, radius, spacing } = useTheme();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors[`${tone}Bg`],
        },
        style,
      ]}>
      <Icon icon={tone === 'danger' ? CircleExclamationPoint : Info} color={colors[`${tone}Fg`]} />
      <Text variant="bodyStrong" tone={tone} style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
