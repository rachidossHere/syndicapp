/** Dimensions fixes du design system, en px (plan 02). */
export const sizes = {
  /** Zone tactile minimale de tout élément appuyable. */
  touchTarget: 44,
  /** Diamètre par défaut d'un avatar. */
  avatar: 40,
  /** Hauteur des boutons : 48 par défaut, 52 en taille `lg`. */
  button: { md: 48, lg: 52 },
  /** Hauteur d'un champ de saisie. */
  input: 48,
  /** Icônes lucide : 20 dans les boutons et listes, 22 dans la barre d'onglets. */
  icon: 20,
  tabIcon: 22,
  /** Épaisseur du trait des icônes lucide. */
  iconStroke: 2,
  /** Carré coloré qui contient l'icône d'une tuile d'action. */
  iconBox: 40,
  /** Hauteur minimale d'une tuile d'action de l'accueil syndic. */
  actionTileMinHeight: 112,
} as const;

export type SizeToken = keyof typeof sizes;

/** Épaisseurs de bordure, en px. */
export const borderWidth = {
  /** Cartes, champs, boutons secondaires (le focus d'un champ change la couleur, pas l'épaisseur). */
  thin: 1,
} as const;

export type BorderWidthToken = keyof typeof borderWidth;

/** Opacités. */
export const opacity = {
  /** Retour visuel d'appui quand aucune couleur « appuyée » n'existe (bouton accent). */
  pressed: 0.85,
} as const;

export type OpacityToken = keyof typeof opacity;
