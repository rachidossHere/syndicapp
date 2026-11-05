/**
 * Échelle typographique (plan 02) : taille et interligne en px, graisse.
 * La famille de police (Plus Jakarta Sans ou IBM Plex Sans Arabic) est choisie
 * par le composant `Text` selon la langue et la graisse, pas ici.
 */
export const typography = {
  /** Montant principal d'une carte. */
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  /** Titre d'écran web. */
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  /** Titre d'écran mobile. */
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  /** Titre de section, titre de carte. */
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  /** Libellé d'élément de liste, bouton. */
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  /** Texte courant. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  /** Texte secondaire, dates. */
  small: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  /** Badges, onglets, petites étiquettes. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
} as const;

export type Typography = typeof typography;
export type TypographyToken = keyof Typography;
export type FontWeightToken = Typography[TypographyToken]['fontWeight'];

/** En arabe, l'interligne est augmenté d'environ 15 % (appliqué par le composant `Text`). */
export const ARABIC_LINE_HEIGHT_FACTOR = 1.15;
