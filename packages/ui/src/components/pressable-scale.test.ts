import { describe, expect, it } from 'vitest';

import reducedMotionSource from '../motion/use-reduced-motion.ts?raw';
import { motion } from '../tokens/motion';
import { opacity, sizes } from '../tokens/sizes';
import { hitSlopFor, pressFeedback, type PressFeedbackTokens } from './press-feedback';
import pressableSource from './pressable-scale.tsx?raw';

const tokens: PressFeedbackTokens = {
  pressScale: motion.pressScale,
  fastMs: motion.duration.fast,
  pressedOpacity: opacity.pressed,
};

describe('PressableScale : retour d’appui', () => {
  it('mouvement normal : enfoncement léger en 150 ms pendant l’appui, retour à 1 au relâchement', () => {
    expect(pressFeedback({ pressed: true, reducedMotion: false }, tokens)).toEqual({
      scale: 0.97,
      opacity: 1,
      transitionMs: 150,
    });
    expect(pressFeedback({ pressed: false, reducedMotion: false }, tokens)).toEqual({
      scale: 1,
      opacity: 1,
      transitionMs: 150,
    });
  });

  it('mouvement réduit : aucune échelle ni transition, seulement un changement d’opacité immédiat', () => {
    expect(pressFeedback({ pressed: true, reducedMotion: true }, tokens)).toEqual({
      scale: 1,
      opacity: opacity.pressed,
      transitionMs: 0,
    });
    expect(pressFeedback({ pressed: false, reducedMotion: true }, tokens)).toEqual({
      scale: 1,
      opacity: 1,
      transitionMs: 0,
    });
  });

  it('mouvement réduit : jamais d’échelle, quel que soit l’état', () => {
    for (const pressed of [true, false]) {
      for (const disabled of [true, false]) {
        const feedback = pressFeedback({ pressed, reducedMotion: true, disabled }, tokens);
        expect(feedback.scale).toBe(1);
        expect(feedback.transitionMs).toBe(0);
      }
    }
  });

  it('désactivé : aucun retour d’appui', () => {
    expect(
      pressFeedback({ pressed: true, reducedMotion: false, disabled: true }, tokens),
    ).toMatchObject({ scale: 1, opacity: 1 });
  });
});

describe('PressableScale : zone tactile', () => {
  it('un contenu de 30 × 20 reçoit une marge de toucher jusqu’à 44 px, sans agrandir le visuel', () => {
    expect(hitSlopFor(30, 20, sizes.touchTarget)).toEqual({
      top: 12,
      bottom: 12,
      left: 7,
      right: 7,
    });
  });

  it('un contenu déjà assez grand n’a aucune marge', () => {
    expect(hitSlopFor(120, 56, sizes.touchTarget)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
    expect(hitSlopFor(44, 44, sizes.touchTarget)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('PressableScale : composant', () => {
  it('lit « Réduire les animations » et applique le retour d’appui des jetons', () => {
    expect(pressableSource).toContain('useReducedMotion()');
    expect(pressableSource).toContain('pressFeedback(');
    expect(pressableSource).toContain('motion.pressScale');
    expect(pressableSource).toContain('motion.duration.fast');
    expect(pressableSource).toContain('cubicBezier(...motion.easing.out)');
  });

  it('le toucher n’est jamais retardé : onPress passé tel quel, aucun délai ni attente d’animation', () => {
    expect(pressableSource).toContain('onPress={onPress}');
    expect(pressableSource).not.toMatch(/setTimeout|await |withDelay|runOnJS|scheduleOnRN/);
  });

  it('accessible : rôle, libellé, état désactivé, zone d’au moins 44 px', () => {
    expect(pressableSource).toContain('accessibilityRole={accessibilityRole}');
    expect(pressableSource).toContain('accessibilityLabel={accessibilityLabel}');
    expect(pressableSource).toContain('accessibilityState={{ disabled }}');
    expect(pressableSource).toContain('hitSlopFor(size.width, size.height, sizes.touchTarget)');
  });

  it('seuls transform et opacité sont animés (pas de mise en page)', () => {
    expect(pressableSource).toContain("transitionProperty: 'transform'");
    expect(pressableSource).not.toMatch(/transitionProperty: '(width|height|margin|padding|flex)/);
  });

  it('useReducedMotion vient de Reanimated et est exposé par @syndic/ui', () => {
    expect(reducedMotionSource).toContain(
      "export { useReducedMotion } from 'react-native-reanimated'",
    );
  });

  it('aucune valeur de durée, de courbe ou d’échelle codée en dur', () => {
    expect(pressableSource).not.toMatch(/\b(150|250|0\.97)\b/);
    expect(pressableSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
