// Textes du reçu PDF, en français pour le MVP (le PDF arabe viendra plus tard).
// Les textes de l'appli passent par ses fichiers de traduction ; ceux-ci ne servent qu'au PDF.
import { TIMEZONE, type PaymentMethod, type Role } from '@syndic/shared';

export const RECEIPT_FR = {
  brand: 'SyndicApp',
  title: (number: string) => `Reçu n° ${number}`,
  paid: 'Payé',
  cancelled: 'Annulé',
  cancelledStamp: 'ANNULÉ',
  cancelledOn: (date: string) => `Paiement annulé le ${date}`,
  residence: 'Résidence',
  lot: 'Appartement',
  period: 'Période',
  amount: 'Montant',
  method: 'Mode',
  date: 'Date',
  recordedBy: 'Encaissé par',
  footer: 'Reçu généré par SyndicApp',
} as const;

const METHODS: Record<PaymentMethod, string> = { cash: 'Espèces', transfer: 'Virement' };
export const methodLabel = (method: PaymentMethod): string => METHODS[method];

/** Qui a encaissé : le rôle, jamais le nom de la personne. */
export function recordedByLabel(role: Role | null): string {
  if (role === 'manager') return 'Le syndic';
  if (role === 'treasurer') return 'Le trésorier';
  return 'Le bureau du syndic';
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 2026-Q4 » → « 4e trimestre 2026 » ; « 2026-11 » → « novembre 2026 ». */
export function periodLabelFr(label: string): string {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(label);
  if (quarter) return `${quarter[2] === '1' ? '1er' : `${quarter[2]}e`} trimestre ${quarter[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(label);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`;
  return label;
}

/** Date dans le fuseau Africa/Casablanca : « 5 novembre 2026 ». */
export function dateFr(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // AAAA-MM-JJ
  const [year, month, day] = parts.split('-').map(Number) as [number, number, number];
  return `${day === 1 ? '1er' : day} ${MONTHS[month - 1]} ${year}`;
}
