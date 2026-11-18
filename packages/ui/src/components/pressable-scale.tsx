import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

import { useReducedMotion } from '../motion/use-reduced-motion';
import { useTheme } from '../theme/theme-provider';
import { hitSlopFor, pressFeedback } from './press-feedback';

export type PressableScaleProps = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Mise en page uniquement (marges, flex) : jamais les couleurs. */
  style?: StyleProp<ViewStyle>;
  /** Libellé lu par les lecteurs d'écran (obligatoire si le contenu n'est pas un texte). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Rôle annoncé : `button` par défaut (un lien : `link`). */
  accessibilityRole?: 'button' | 'link';
  testID?: string;
};

/**
 * Zone appuyable qui s'enfonce légèrement au toucher (échelle `motion.pressScale`, `motion.duration.fast`,
 * courbe `motion.easing.out`). Transition CSS de Reanimated : elle tourne sur le fil de l'interface.
 *
 * - « Réduire les animations » activé : aucune échelle ni transition, seulement un changement
 *   d'opacité immédiat.
 * - Le toucher n'est jamais retardé : `onPress` part au relâchement, sans attendre l'animation.
 * - Zone tactile d'au moins 44 px : un contenu plus petit reçoit un `hitSlop`, le visuel ne grandit pas.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
}: PressableScaleProps) {
  const { motion, opacity, sizes } = useTheme();
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: sizes.touchTarget,
    height: sizes.touchTarget,
  });

  const feedback = pressFeedback(
    { pressed, reducedMotion, disabled },
    {
      pressScale: motion.pressScale,
      fastMs: motion.duration.fast,
      pressedOpacity: opacity.pressed,
    },
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlopFor(size.width, size.height, sizes.touchTarget)}
      onLayout={onLayout}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
      testID={testID}
    >
      <Animated.View
        style={{
          flexGrow: 1,
          opacity: feedback.opacity,
          transform: [{ scale: feedback.scale }],
          transitionProperty: 'transform',
          transitionDuration: feedback.transitionMs,
          transitionTimingFunction: cubicBezier(...motion.easing.out),
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
