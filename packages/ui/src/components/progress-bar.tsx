import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import type { StatusTone } from '../tokens/status';

export type ProgressBarProps = {
  /** Avancement entre 0 et 1 (borné). */
  value: number;
  /** Libellé lu par les lecteurs d'écran (ex. « Encaissé : 15 500 MAD sur 21 600 MAD »). */
  accessibilityLabel: string;
  /** Couleur de la partie remplie. Par défaut : `success`. */
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Barre de progression (écran « Charges » : part encaissée d'un appel).
 * Remplie depuis le début de la ligne : de gauche à droite en français, de droite à gauche en arabe.
 * L'avancement est aussi annoncé en pourcentage : jamais signalé par la couleur seule.
 */
export function ProgressBar({ value, accessibilityLabel, tone = 'success', style, testID }: ProgressBarProps) {
  const { colors, radius, sizes } = useTheme();
  const ratio = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      testID={testID}
      style={[
        {
          height: sizes.progressBar,
          borderRadius: radius.pill,
          backgroundColor: colors.border,
          overflow: 'hidden',
          flexDirection: 'row',
        },
        style,
      ]}>
      <View style={{ width: `${percent}%`, backgroundColor: colors[`${tone}Fg`], borderRadius: radius.pill }} />
    </View>
  );
}
