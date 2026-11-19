import { useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { fadeIn, riseIn } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';

export type AppearProps = {
  children: ReactNode;
  /** Attente avant l'apparition, en ms (cascade : un multiple de `motion.stagger`). */
  delay?: number;
  /** Fondu et léger glissement (par défaut). `false` : fondu seul. */
  slide?: boolean;
  /** Coupe l'animation : le contenu s'affiche directement. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Contenu qui apparaît à son affichage : fondu et léger glissement (`motion.duration.normal`,
 * courbe `out`). L'animation est un habillage : le contenu est à sa place et appuyable dès le premier
 * instant, rien n'attend la fin du mouvement.
 *
 * « Réduire les animations » activé : le contenu s'affiche directement, sans fondu ni glissement.
 */
export function Appear({
  children,
  delay = 0,
  slide = true,
  disabled = false,
  style,
  testID,
}: AppearProps) {
  const reducedMotion = useReducedMotion();
  const entering = useMemo(
    () => (reducedMotion || disabled ? undefined : slide ? riseIn(delay) : fadeIn(delay)),
    [reducedMotion, disabled, slide, delay],
  );

  return (
    <Animated.View entering={entering} style={style} testID={testID}>
      {children}
    </Animated.View>
  );
}
