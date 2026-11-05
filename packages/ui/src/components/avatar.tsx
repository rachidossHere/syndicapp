import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { getInitials } from './initials';
import { Text } from './text';

export type AvatarProps = {
  /** Nom de la personne : sert aux initiales et au libellé lu par les lecteurs d'écran. */
  name: string;
  /** Diamètre en px. Par défaut : `sizes.avatar` (40). */
  size?: number;
  /** Style de mise en page (fusionné en dernier). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Avatar rond avec les initiales du nom : fond `primarySoft`, texte `primary`. */
export function Avatar({ name, size, style, testID }: AvatarProps) {
  const { colors, radius, sizes } = useTheme();
  const diameter = size ?? sizes.avatar;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      testID={testID}
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius: radius.pill,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {/* Taille fixe : les initiales ne grossissent pas avec le texte système, sinon elles débordent du cercle. */}
      <Text variant="bodyStrong" tone="primary" allowFontScaling={false} importantForAccessibility="no">
        {getInitials(name)}
      </Text>
    </View>
  );
}
