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
  /** Petit carré d'icône (liste d'avantages, puces). */
  iconBoxSm: 32,
  /** Logo de l'appli sur l'écran d'accueil. */
  logo: 64,
  /** Pastille teintée d'une icône (plan 02b) : 40, 48 ou 56 px ; l'icône à l'intérieur fait la moitié. */
  iconTile: { sm: 40, md: 48, lg: 56 },
  iconTileGlyph: { sm: 20, md: 24, lg: 28 },
  /** Côté de la cellule répétée du motif zellige. */
  zelligeCell: 48,
  /** Hauteur minimale d'une tuile d'action de l'accueil syndic. */
  actionTileMinHeight: 112,
  /** Hauteur minimale d'une tuile de choix (grille des appartements à encaisser). */
  choiceTile: 52,
  /** Épaisseur d'une barre de progression. */
  progressBar: 8,
  /** Hauteur de la zone « Prendre la facture en photo » (et de l'aperçu de la facture). */
  invoiceZone: 176,
  /** Hauteur de la zone « Ajouter une photo » d'un signalement. */
  photoZone: 96,
} as const;

export type SizeToken = keyof typeof sizes;

/** Épaisseurs de bordure, en px. */
export const borderWidth = {
  /** Cartes, champs, boutons secondaires (le focus d'un champ change la couleur, pas l'épaisseur). */
  thin: 1,
  /** Carte mise en avant (annonce épinglée) : bordure `primary` plus marquée. */
  strong: 2,
} as const;

export type BorderWidthToken = keyof typeof borderWidth;

/** Opacités. */
export const opacity = {
  /** Retour visuel d'appui quand aucune couleur « appuyée » n'existe (bouton accent). */
  pressed: 0.85,
  /** Fond assombri derrière une feuille (couleur `text`). */
  scrim: 0.4,
  /** Remplissage léger d'une icône duotone (même couleur que le contour). */
  duotoneFill: 0.18,
  /** Motif zellige sur un en-tête ou un état vide. */
  zellige: 0.1,
} as const;

export type OpacityToken = keyof typeof opacity;
