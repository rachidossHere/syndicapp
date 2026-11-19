import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEaseOut } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { useTheme } from '../theme/theme-provider';
import { pressFeedback } from './press-feedback';

// `Pressable` animé : la transition CSS de Reanimated tourne sur le fil d'interface, sans état par image.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableSurfaceProps = Pick<
  PressableProps,
  | 'onPress'
  | 'onLongPress'
  | 'disabled'
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'accessibilityState'
  | 'testID'
  | 'children'
> & {
  /**
   * `scale` : léger enfoncement de toute la surface (cartes, tuiles, boutons).
   * `background` : le fond et la bordure changent, sans échelle (lignes de liste pleine largeur).
   */
  feedback: 'scale' | 'background';
  /** Fond et bordure pendant l'appui (jetons du thème) : ils changent en `motion.duration.fast`. */
  pressedStyle?: ViewStyle;
  /** Style de la surface : le fond, la bordure et la mise en page. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Surface appuyable du design system : retour au toucher animé, jamais d'attente. `onPress` part au
 * relâchement, sans attendre la fin de l'animation.
 *
 * « Réduire les animations » activé : plus d'échelle ni de transition. L'appui se voit par un
 * changement d'opacité (`scale`) ou de fond (`background`), immédiat.
 */
export function PressableSurface({
  feedback,
  pressedStyle,
  style,
  disabled = false,
  ...pressableProps
}: PressableSurfaceProps) {
  const { motion, opacity } = useTheme();
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  const press = pressFeedback(
    { pressed, reducedMotion, disabled },
    {
      pressScale: motion.pressScale,
      fastMs: motion.duration.fast,
      pressedOpacity: opacity.pressed,
    },
  );
  const colorsChange = feedback === 'background' || pressedStyle !== undefined;
  const scales = feedback === 'scale';

  return (
    <AnimatedPressable
      {...pressableProps}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        style,
        pressed && !disabled && pressedStyle,
        {
          ...(scales ? { opacity: press.opacity, transform: [{ scale: press.scale }] } : null),
          transitionProperty: [
            ...(scales ? (['transform'] as const) : []),
            ...(colorsChange ? (['backgroundColor', 'borderColor'] as const) : []),
          ],
          transitionDuration: press.transitionMs,
          transitionTimingFunction: cssEaseOut,
        },
      ]}
    />
  );
}
