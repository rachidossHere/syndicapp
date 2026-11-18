// Retour visuel d'un appui (plan 02b) : fonction pure, sans React ni Reanimated, testée avec vitest.
//
// Mouvement normal : léger enfoncement (échelle) en `motion.duration.fast`.
// Mouvement réduit (« Réduire les animations ») : plus d'échelle ni de transition ; seul un
// changement d'opacité instantané signale l'appui (jamais l'absence de retour). Dans les deux cas
// le toucher n'est jamais retardé : l'animation est un habillage, pas une attente.
export type PressFeedbackTokens = {
  pressScale: number;
  fastMs: number;
  /** Opacité d'un élément appuyé quand le mouvement est réduit. */
  pressedOpacity: number;
};

export type PressFeedback = {
  scale: number;
  opacity: number;
  /** Durée de la transition en ms ; 0 = changement immédiat. */
  transitionMs: number;
};

export function pressFeedback(
  input: { pressed: boolean; reducedMotion: boolean; disabled?: boolean },
  tokens: PressFeedbackTokens,
): PressFeedback {
  if (input.disabled || !input.pressed) {
    return { scale: 1, opacity: 1, transitionMs: input.reducedMotion ? 0 : tokens.fastMs };
  }
  return input.reducedMotion
    ? { scale: 1, opacity: tokens.pressedOpacity, transitionMs: 0 }
    : { scale: tokens.pressScale, opacity: 1, transitionMs: tokens.fastMs };
}

/**
 * Marge de toucher à ajouter autour d'un élément trop petit pour atteindre `min` px (hitSlop), sans
 * agrandir le visuel. Zéro quand l'élément est assez grand.
 */
export function hitSlopFor(width: number, height: number, min: number) {
  const horizontal = Math.max(0, Math.ceil((min - width) / 2));
  const vertical = Math.max(0, Math.ceil((min - height) / 2));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}
