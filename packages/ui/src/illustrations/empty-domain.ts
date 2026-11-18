// Domaines des états vides illustrés (plan 02b, étape 2) : fonction pure, sans React.
export const EMPTY_DOMAINS = [
  'issues',
  'announcements',
  'charges',
  'expenses',
  'apartments',
  'generic',
] as const;

export type EmptyDomain = (typeof EMPTY_DOMAINS)[number];

/** Pictogramme de chaque domaine : un dessin distinct par domaine. */
export const EMPTY_ILLUSTRATION_NAMES = {
  issues: 'clipboard',
  announcements: 'megaphone',
  charges: 'wallet',
  expenses: 'receipt',
  apartments: 'building',
  generic: 'box',
} as const satisfies Record<EmptyDomain, string>;

export type EmptyIllustrationName = (typeof EMPTY_ILLUSTRATION_NAMES)[EmptyDomain];

export const emptyIllustrationName = (domain: EmptyDomain): EmptyIllustrationName =>
  EMPTY_ILLUSTRATION_NAMES[domain];
