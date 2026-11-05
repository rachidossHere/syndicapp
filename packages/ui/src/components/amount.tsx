import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { formatAmount, type AmountDirection } from './amount-format';
import { Text, type TextTone, type TextVariant } from './text';

export type AmountProps = {
  /** Montant en centimes (entier). */
  centimes: number;
  /** `in` : entrée (vert, « + »). `out` : sortie (terracotta, « − »). Par défaut : `neutral`. */
  direction?: AmountDirection;
  /** Style typographique. Par défaut : `bodyStrong`. */
  variant?: TextVariant;
  /** Ton d'un montant neutre (ex. `inverse` sur une carte `primary`). Ignoré pour `in` et `out`. */
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/** Montant formaté « 18 420 MAD », signe et couleur selon le sens. */
export function Amount({
  centimes,
  direction = 'neutral',
  variant = 'bodyStrong',
  tone = 'default',
  style,
  testID,
}: AmountProps) {
  const { colors } = useTheme();
  const color =
    direction === 'in' ? colors.successFg : direction === 'out' ? colors.moneyOut : undefined;

  return (
    <Text
      variant={variant}
      tone={tone}
      testID={testID}
      style={[
        // Chiffres à chasse fixe : les montants s'alignent en colonne.
        { fontVariant: ['tabular-nums'], writingDirection: 'ltr' },
        color !== undefined && { color },
        style,
      ]}>
      {formatAmount(centimes, direction)}
    </Text>
  );
}
