/**
 * Couleurs du design system (plan 02). Thème clair uniquement pour le MVP.
 * Les jetons sont nommés par rôle (`bg`, `surface`, `text`…) et non par teinte,
 * pour pouvoir ajouter un thème sombre plus tard sans toucher aux écrans.
 */
export const colors = {
  // Marque
  /** Boutons principaux, onglet actif, liens. */
  primary: '#0F5257',
  /** Bouton principal appuyé. */
  primaryPressed: '#0A3A3E',
  /** Fond d'élément sélectionné, avatars. */
  primarySoft: '#E6EFEE',
  /** Bouton principal désactivé. */
  primaryDisabled: '#8FA9AB',
  /** Une seule action clé par écran (ex. « Payer maintenant ») ; texte dessus : `text`. */
  accent: '#F2B33D',

  // Neutres
  /** Fond des écrans. */
  bg: '#F6F2EA',
  /** Cartes, champs, barre d'onglets. */
  surface: '#FFFFFF',
  /** Fond de champ, encadrés secondaires. */
  surfaceMuted: '#FBF9F4',
  /** Bordure des cartes. */
  border: '#E9E2D4',
  /** Bordure des champs et boutons secondaires. */
  borderStrong: '#CFC6B4',
  /** Texte principal. */
  text: '#1D2327',
  /** Texte secondaire, libellés. */
  textMuted: '#5C6670',
  /** Onglets inactifs. */
  iconInactive: '#6B747C',
  /** Texte sur `primary`. */
  textInverse: '#FFFFFF',

  // États (fond / texte)
  /** Payé, résolu, confirmation. */
  successBg: '#DCEFE6',
  /** Payé, résolu, confirmation, entrée d'argent. */
  successFg: '#1F5E43',
  /** En cours, échéance proche. */
  warningBg: '#FCEBD0',
  warningFg: '#7A4F00',
  /** Impayé, ouvert, urgent. */
  dangerBg: '#FBE3DA',
  dangerFg: '#8E3512',
  /** Information neutre. */
  infoBg: '#E3E8F4',
  infoFg: '#2E4A86',

  /** Sorties d'argent. */
  moneyOut: '#A8461B',
} as const;

export type Colors = typeof colors;
export type ColorToken = keyof Colors;
