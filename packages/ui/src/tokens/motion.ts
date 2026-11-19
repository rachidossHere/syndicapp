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
    /** Compteur du solde de la caisse au premier affichage (jamais plus long). */
    count: 600,
    /** Une descente (ou une remontée) de la pulsation d'un squelette de chargement : mouvement continu, pas une réponse à un geste. */
    pulse: 1000,
  },
  /** Décalage entre deux éléments d'une cascade, en ms. */
  stagger: 40,
  /** Nombre d'éléments d'une liste qui apparaissent en cascade (les suivants apparaissent sans animation). */
  staggerMax: 8,
  /**
   * Au-delà de ce nombre de lignes, une liste non virtualisée (ScrollView) ne glisse plus quand un
   * élément est ajouté ou retiré : seule l'apparition en cascade du premier affichage s'anime.
   */
  reflowMax: 30,
  /** Distance du léger glissement d'une apparition, en px. */
  enterOffset: 8,
  /** Opacité la plus basse de la pulsation d'un squelette. */
  pulseMinOpacity: 0.5,
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
