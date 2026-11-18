/**
 * Teintes par domaine (plan 02b) : fond de pastille (ou de carte) et couleur d'icône assortie.
 * Chaque paire respecte un contraste d'au moins 4,5:1 (test `contrast.test.ts`), donc l'icône
 * comme un éventuel libellé restent lisibles. Les écrans choisissent un domaine, jamais une valeur.
 *
 * Les cinq premiers sont les domaines du plan 02b ; les trois derniers (résidence, membres,
 * notifications) servent aux autres icônes de la maquette `docs/design-v2.png`.
 */
export const DOMAINS = [
  'charges',
  'expenses',
  'issues',
  'announcements',
  'accounts',
  'residence',
  'members',
  'notifications',
] as const;

export type Domain = (typeof DOMAINS)[number];

export type DomainColors = {
  /** Fond teinté. */
  bg: string;
  /** Icône (et texte) assortis au fond. */
  fg: string;
};

export const domainColors: Record<Domain, DomainColors> = {
  charges: { bg: '#DCEFE6', fg: '#1F5E43' },
  expenses: { bg: '#FBE9C8', fg: '#8A5A00' },
  issues: { bg: '#F8E1D8', fg: '#A24A27' },
  announcements: { bg: '#E3E8F4', fg: '#2E4A86' },
  accounts: { bg: '#E9E3F5', fg: '#5B3FA0' },
  residence: { bg: '#E0EEEC', fg: '#0F5257' },
  members: { bg: '#E6E8F6', fg: '#3A4A9B' },
  notifications: { bg: '#FBF0CC', fg: '#7A5A00' },
};
