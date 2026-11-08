// Fonctions pures des écrans de charges : périodes, dates et saisie des montants.
// Sans React ni Intl obligatoire (support partiel sur Hermes) : testables avec vitest.
import { TIMEZONE, type ChargePeriod } from '@syndic/shared';

export type ParsedPeriod =
  | { kind: 'quarter'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { kind: 'month'; year: number; month: number };

/** « 2026-Q4 » ou « 2026-11 » → période ; `undefined` pour un libellé inconnu. */
export function parsePeriod(label: string): ParsedPeriod | undefined {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(label);
  if (quarter) return { kind: 'quarter', year: Number(quarter[1]), quarter: Number(quarter[2]) as 1 | 2 | 3 | 4 };
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  if (month) return { kind: 'month', year: Number(month[1]), month: Number(month[2]) };
  return undefined;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Libellé de la période qui contient la date `today` (AAAA-MM-JJ). */
export function periodOf(period: ChargePeriod, today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return period === 'quarterly' ? `${year}-Q${Math.ceil(month / 3)}` : `${year}-${pad(month)}`;
}

/** La période en cours et les `count - 1` suivantes. */
export function upcomingPeriods(period: ChargePeriod, today: string, count: number): string[] {
  let year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const step = period === 'quarterly' ? 4 : 12;
  let index = period === 'quarterly' ? Math.ceil(month / 3) : month;
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(period === 'quarterly' ? `${year}-Q${index}` : `${year}-${pad(index)}`);
    index += 1;
    if (index > step) {
      index = 1;
      year += 1;
    }
  }
  return labels;
}

/**
 * Échéance proposée : le 15 du dernier mois de la période (« 15 décembre » pour le 4e trimestre),
 * ou aujourd'hui si cette date est déjà passée.
 */
export function defaultDueDate(label: string, today: string): string {
  const parsed = parsePeriod(label);
  if (!parsed) return today;
  const month = parsed.kind === 'quarter' ? parsed.quarter * 3 : parsed.month;
  const proposed = `${parsed.year}-${pad(month)}-15`;
  return proposed < today ? today : proposed;
}

/** Date AAAA-MM-JJ → { année, mois, jour }. */
export function dateParts(date: string): { year: number; month: number; day: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

/** Date (AAAA-MM-JJ) d'un instant, dans le fuseau Africa/Casablanca. */
export function casablancaDate(instant: Date | string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    const value = `${get('year')}-${get('month')}-${get('day')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  } catch {
    // Fuseau non pris en charge : repli ci-dessous.
  }
  // Repli : heure du Maroc (UTC+1 hors ramadan).
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Aujourd'hui (AAAA-MM-JJ) à Casablanca. */
export const todayCasablanca = (): string => casablancaDate(new Date());

/** Date → AAAA-MM-JJ selon le calendrier local de l'appareil (sélecteur de date). */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** AAAA-MM-JJ → Date à midi, heure locale (évite tout décalage de jour dans le sélecteur). */
export function dateFromString(value: string): Date {
  const { year, month, day } = dateParts(value);
  return new Date(year, month - 1, day, 12);
}

/**
 * Saisie d'un montant en dirhams (« 450 », « 450,50 », « 1 200.5 ») → centimes (entier > 0).
 * `undefined` si la saisie est vide, invalide, nulle ou a plus de deux décimales.
 */
export function parseMadInput(text: string): number | undefined {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [units, decimals = ''] = cleaned.split('.');
  const centimes = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(centimes) && centimes > 0 ? centimes : undefined;
}

/** Centimes → texte pré-rempli d'un champ de montant : « 450 » ou « 450,50 ». */
export function formatMadInput(centimes: number): string {
  const units = Math.floor(centimes / 100);
  const cents = centimes % 100;
  return cents === 0 ? String(units) : `${units},${String(cents).padStart(2, '0')}`;
}
