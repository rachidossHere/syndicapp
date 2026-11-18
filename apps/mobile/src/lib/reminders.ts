// Relance des impayés (plan 08, étape 4) : état des boutons de l'écran « Impayés », libellé du dernier
// rappel et toast. Fonctions pures, sans React : testées avec vitest.
import type { DueStatus, Language } from '@syndic/shared';

import { translate, type TranslationKey } from '../i18n/translate';
import { casablancaDate, dateParts } from './charges-format';

/** Un dû vu par l'écran « Impayés » (les dates ne sont données qu'au syndic, charges.write). */
export type ReminderDue = {
  status: DueStatus;
  lastReminderAt?: string | null;
  /** Prochaine relance possible : `null` ou absente quand le lot peut être relancé maintenant. */
  nextReminderAt?: string | null;
};

/** Lots à relancer : impayés ou partiels (un payé n'a rien à faire sur cet écran). */
export const isUnpaid = (due: Pick<ReminderDue, 'status'>): boolean => due.status !== 'paid';

/** Le lot est-il en attente (relancé il y a moins de 3 jours) ? */
export function isCoolingDown(due: ReminderDue, now: Date = new Date()): boolean {
  return (
    Boolean(due.nextReminderAt) && new Date(due.nextReminderAt as string).getTime() > now.getTime()
  );
}

/** Bouton d'un lot : « Relancer » actif, « Relancé » désactivé, ou aucun (lot payé). */
export type ReminderButtonState = 'remind' | 'reminded' | 'none';

export function reminderButtonState(due: ReminderDue, now: Date = new Date()): ReminderButtonState {
  if (!isUnpaid(due)) return 'none';
  return isCoolingDown(due, now) ? 'reminded' : 'remind';
}

/** Nombre de lots que « Relancer tous les impayés (N) » relancerait réellement. */
export function remindableCount(dues: readonly ReminderDue[], now: Date = new Date()): number {
  return dues.filter((due) => reminderButtonState(due, now) === 'remind').length;
}

export type ReminderAgo =
  { kind: 'today' } | { kind: 'yesterday' } | { kind: 'days'; count: number };

/** Il y a combien de jours (calendrier de Casablanca) : « aujourd'hui », « hier », « il y a N jours ». */
export function reminderAgo(lastReminderAt: string, now: Date = new Date()): ReminderAgo {
  const toDay = (date: string) => {
    const { year, month, day } = dateParts(date);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  const days = Math.max(
    0,
    Math.round(toDay(casablancaDate(now)) - toDay(casablancaDate(lastReminderAt))),
  );
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  return { kind: 'days', count: days };
}

/** Clé du toast selon le nombre de lots relancés (singulier ou pluriel) ; `none` si aucun. */
export function reminderToastKey(reminded: number): 'none' | 'one' | 'many' {
  if (reminded <= 0) return 'none';
  return reminded === 1 ? 'one' : 'many';
}

/**
 * Ligne affichée sous un lot relancé récemment, par exemple « Relancé hier · nouvelle relance
 * possible le 17 nov. » : quand a eu lieu la dernière relance, et la date de la prochaine possible.
 */
export function formatReminderLine(
  language: Language,
  lastReminderAt: string,
  nextReminderAt: string,
  now: Date = new Date(),
): string {
  const ago = reminderAgo(lastReminderAt, now);
  const when =
    ago.kind === 'today'
      ? translate(language, 'charges.unpaid.agoToday')
      : ago.kind === 'yesterday'
        ? translate(language, 'charges.unpaid.agoYesterday')
        : translate(language, 'charges.unpaid.agoDays', { count: ago.count });
  const { month, day } = dateParts(casablancaDate(nextReminderAt));
  const date = translate(language, 'charges.date.short', {
    day,
    month: translate(language, `charges.dateMonthsShort.${month}` as TranslationKey),
  });
  return translate(language, 'charges.unpaid.remindedLine', { ago: when, date });
}
