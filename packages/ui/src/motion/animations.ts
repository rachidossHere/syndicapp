// Animations d'apparition et de mise en page (plan 02b, étape 4), construites une fois, hors des
// composants (Reanimated recommande de ne pas reconstruire un générateur à chaque rendu), à partir des
// seuls jetons de mouvement : durées `fast` et `normal`, courbe `out`, décalage et distance du glissement.
// Elles tournent sur le fil d'interface. Chaque composant qui les utilise les coupe quand
// « Réduire les animations » est activé (voir `useReducedMotion`).
import {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
  cubicBezier,
} from 'react-native-reanimated';

import { motion } from '../tokens/motion';

/** Courbe des animations pilotées par `withTiming` et par les générateurs d'apparition. */
export const easeOut = Easing.bezier(...motion.easing.out);
/** Courbe des transitions CSS (`transitionTimingFunction`, `animationTimingFunction`). */
export const cssEaseOut = cubicBezier(...motion.easing.out);
export const cssEaseInOut = cubicBezier(...motion.easing.inOut);

/** Fondu seul. `delay` en ms. */
export const fadeIn = (delay = 0) =>
  FadeIn.duration(motion.duration.normal).delay(delay).easing(easeOut);

/** Fondu et léger glissement vers le haut (de `motion.enterOffset` px). `delay` en ms. */
export const riseIn = (delay = 0) =>
  FadeInUp.duration(motion.duration.normal)
    .delay(delay)
    .easing(easeOut)
    .withInitialValues({ opacity: 0, transform: [{ translateY: motion.enterOffset }] });

/** Disparition par fondu, plus courte que l'apparition : la personne a fini de lire. */
export const fadeOutFast = FadeOut.duration(motion.duration.fast).easing(easeOut);

/** Un élément ajouté ou retiré : les autres glissent à leur nouvelle place. */
export const reflowTransition = LinearTransition.duration(motion.duration.normal).easing(easeOut);

/**
 * Durée pendant laquelle une liste qui s'affiche pour la première fois peut animer son apparition :
 * le temps de la cascade (les `staggerMax` premiers éléments, plus la durée d'un fondu).
 */
export const ENTRANCE_WINDOW_MS = motion.duration.normal + motion.stagger * motion.staggerMax;
