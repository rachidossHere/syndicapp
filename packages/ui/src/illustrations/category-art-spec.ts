// Pictogrammes et dégradés des catégories d'annonces (plan 02b, étape 2) : données pures, sans
// React, testées avec vitest. Les couleurs sont des noms de jetons de `colors`.
import type { ColorToken } from '../tokens/colors';

export const CATEGORY_ART_CATEGORIES = ['works', 'meeting', 'info', 'urgent'] as const;
export type CategoryArtCategory = (typeof CATEGORY_ART_CATEGORIES)[number];

export type CategoryArtSpec = {
  /** Jetons de départ (haut) et d'arrivée (bas) du dégradé. */
  from: ColorToken;
  to: ColorToken;
  /** Tracés du pictogramme dans une grille de 24 × 24 (contour, bouts arrondis). */
  paths: readonly string[];
  /** Petits disques pleins du pictogramme : [cx, cy, r]. */
  dots: readonly (readonly [number, number, number])[];
};

export const CATEGORY_ART: Record<CategoryArtCategory, CategoryArtSpec> = {
  // Clé à molette.
  works: {
    from: 'saffron',
    to: 'terracotta',
    paths: [
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    ],
    dots: [],
  },
  // Deux personnes.
  meeting: {
    from: 'primary',
    to: 'tealDeep',
    paths: [
      'M2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1',
      'M16 4.3a3.5 3.5 0 0 1 0 6.4',
      'M21.5 20v-1a4.5 4.5 0 0 0-3-4.2',
    ],
    dots: [[9, 8, 3.5]],
  },
  // Cercle et « i ».
  info: {
    from: 'infoFg',
    to: 'primary',
    paths: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M12 16v-5'],
    dots: [[12, 8, 1]],
  },
  // Triangle et « ! ».
  urgent: {
    from: 'terracotta',
    to: 'dangerFg',
    paths: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4'],
    dots: [[12, 17, 1]],
  },
};
