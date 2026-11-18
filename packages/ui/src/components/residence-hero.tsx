import { View, type StyleProp, type ViewStyle } from 'react-native';

import { GradientFill } from '../illustrations/gradient-fill';
import { ResidenceIllustration } from '../illustrations/residence-illustration';
import { useTheme } from '../theme/theme-provider';
import { Text } from './text';
import { ZelligePattern } from './zellige-pattern';

export type ResidenceHeroProps = {
  /** Nom de la résidence (titre : peut passer à la ligne). */
  name: string;
  /** Rôle de la personne, déjà traduit (ex. « Vous êtes syndic »). */
  roleLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * En-tête de la résidence (écran 1 de docs/design-v2.png) : dégradé `tealDeep` vers `primary`,
 * motif zellige, nom et rôle, illustration de la résidence au bord `end` (à droite en français, à
 * gauche en arabe). Le titre long passe à la ligne et ne passe jamais sous l'illustration.
 */
export function ResidenceHero({ name, roleLabel, style, testID }: ResidenceHeroProps) {
  const { colors, radius, spacing, sizes } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: colors.tealDeep,
          minHeight: sizes.residenceHeroMinHeight,
          justifyContent: 'center',
          padding: spacing.lg,
          // Réserve la place de l'illustration au bord `end` : le texte reste dans l'autre moitié.
          paddingEnd: spacing.lg + sizes.residenceHeroArt,
        },
        style,
      ]}>
      <GradientFill from={colors.tealDeep} to={colors.primary} direction="diagonal" />
      <ZelligePattern color={colors.textInverse} />
      <ResidenceIllustration
        size={sizes.residenceHeroArt}
        style={{ position: 'absolute', end: spacing.md, bottom: 0 }}
      />
      <View style={{ gap: spacing.xs }}>
        {roleLabel !== undefined && (
          <Text variant="caption" tone="inverse">
            {roleLabel}
          </Text>
        )}
        <Text variant="h2" tone="inverse" accessibilityRole="header">
          {name}
        </Text>
      </View>
    </View>
  );
}
