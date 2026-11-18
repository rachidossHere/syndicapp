/**
 * Jetons de mouvement (plan 02b). Données pures : aucune dépendance à Reanimated, pour rester
 * testables ; les composants fabriquent les courbes (`Easing.bezier`, `cubicBezier`) à partir d'ici.
 *
 * Règles (expo-animation) : un mouvement d'interface reste sous 300 ms ; jamais d'`ease-in` ;
 * « Réduire les animations » coupe l'échelle et le déplacement (voir `useReducedMotion`) ; aucune
 * animation ne retarde ni ne bloque une action.
 */
export const motion = {
  duration: {
    /** Retour d'appui, petit changement d'état. */
    fast: 150,
    /** Apparition et disparition d'un élément. */
    normal: 250,
  },
  /** Courbes de Bézier `[x1, y1, x2, y2]`. */
  easing: {
    /** Par défaut : entrée, sortie, retour d'appui. */
    out: [0.23, 1, 0.32, 1],
    /** Élément qui bouge à l'écran. */
    inOut: [0.77, 0, 0.175, 1],
    /** Feuille qui monte du bas (courbe d'iOS). */
    sheet: [0.32, 0.72, 0, 1],
  },
  /** Échelle d'un bouton ou d'une carte pendant l'appui : léger enfoncement. */
  pressScale: 0.97,
} as const;

export type MotionTokens = typeof motion;
export type Bezier = readonly [number, number, number, number];
