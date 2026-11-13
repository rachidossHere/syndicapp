// Grille d'un mois pour le calendrier : fonctions pures (sans React ni Intl), testables avec vitest.
// Les dates sont des chaînes AAAA-MM-JJ ; le calcul se fait en UTC pour ne dépendre ni du fuseau
// ni de l'heure d'été de l'appareil. La semaine commence toujours le lundi.

export type CalendarMonth = {
  year: number;
  /** 1 à 12. */
  month: number;
};

export type CalendarDay = {
  /** AAAA-MM-JJ. */
  date: string;
  /** Jour du mois, 1 à 31. */
  day: number;
};

/** Nombre de jours par semaine. */
export const DAYS_PER_WEEK = 7;

const pad = (value: number) => String(value).padStart(2, '0');

/** Date AAAA-MM-JJ à partir de ses éléments. */
export const toDateString = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;

/** Mois d'une date AAAA-MM-JJ. */
export function monthOf(date: string): CalendarMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** Mois décalé de `delta` mois (négatif : mois précédents). */
export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Nombre de jours d'un mois. */
export function daysInMonth({ year, month }: CalendarMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Position du 1er du mois dans la semaine, lundi = 0 … dimanche = 6. */
export function firstWeekdayIndex({ year, month }: CalendarMonth): number {
  const sundayFirst = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (sundayFirst + 6) % DAYS_PER_WEEK;
}

/**
 * Semaines d'un mois, lundi en premier. Chaque semaine a 7 cases : `null` pour un jour qui
 * n'appartient pas au mois (avant le 1er, après le dernier jour).
 */
export function monthWeeks(target: CalendarMonth): (CalendarDay | null)[][] {
  const lead = firstWeekdayIndex(target);
  const total = daysInMonth(target);
  const cells: (CalendarDay | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= total; day++) {
    cells.push({ date: toDateString(target.year, target.month, day), day });
  }
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_PER_WEEK) weeks.push(cells.slice(i, i + DAYS_PER_WEEK));
  return weeks;
}

/** Une date est sélectionnable si elle est dans les bornes (incluses) ; une borne absente ne limite pas. */
export function isDateSelectable(date: string, minimum?: string, maximum?: string): boolean {
  if (minimum !== undefined && date < minimum) return false;
  if (maximum !== undefined && date > maximum) return false;
  return true;
}

/** Un mois est consultable s'il contient au moins un jour sélectionnable. */
export function isMonthReachable(target: CalendarMonth, minimum?: string, maximum?: string): boolean {
  const first = toDateString(target.year, target.month, 1);
  const last = toDateString(target.year, target.month, daysInMonth(target));
  if (minimum !== undefined && last < minimum) return false;
  if (maximum !== undefined && first > maximum) return false;
  return true;
}
