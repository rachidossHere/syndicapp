import { ISSUE_LOCATION_LABEL_KEYS, type IssueLocation } from '@syndic/shared';
import { useCallback, useMemo } from 'react';

import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { casablancaDate, dateParts } from '@/lib/charges-format';
import { ageOf, clockOf, dayRelation, type IssueItem } from '@/lib/issues';

// Clés construites à partir d'identifiants fermés : leur existence en FR et en AR est testée.
const key = (value: string) => value as TranslationKey;

/** Libellés des signalements (emplacement, âge, heure, date) dans la langue active. */
export function useIssueFormat() {
  const t = useT();

  const location = useCallback(
    (value: IssueLocation) => t(key(ISSUE_LOCATION_LABEL_KEYS[value])),
    [t],
  );

  /** « 9 h 10 » (« 09:10 » en arabe), heure de Casablanca. */
  const time = useCallback(
    (instant: string) => {
      const { hour, minute } = clockOf(instant);
      return t('issues.time', { hour, minute: String(minute).padStart(2, '0') });
    },
    [t],
  );

  /** « 3 nov. » à partir d'une date AAAA-MM-JJ. */
  const shortDate = useCallback(
    (date: string) => {
      const { month, day } = dateParts(date);
      return t('issues.age.date', { day, month: t(key(`charges.dateMonthsShort.${month}`)) });
    },
    [t],
  );

  /** « il y a 2 h », « hier », « 3 nov. ». */
  const age = useCallback(
    (instant: string, now: Date = new Date()) => {
      const value = ageOf(instant, now);
      switch (value.kind) {
        case 'now':
          return t('issues.age.now');
        case 'minutes':
          return t('issues.age.minutes', { count: value.count });
        case 'hours':
          return t('issues.age.hours', { count: value.count });
        case 'yesterday':
          return t('issues.age.yesterday');
        case 'date':
          return shortDate(value.date);
      }
    },
    [t, shortDate],
  );

  /** Ligne de la liste : « Ascenseur · il y a 2 h ». */
  const listLine = useCallback(
    (issue: Pick<IssueItem, 'location' | 'createdAt'>, now?: Date) =>
      t('issues.line', { location: location(issue.location), age: age(issue.createdAt, now) }),
    [t, location, age],
  );

  /** Ligne du détail : « Ascenseur · signalé aujourd'hui à 9 h 10 ». */
  const reportedLine = useCallback(
    (issue: Pick<IssueItem, 'location' | 'createdAt'>, now: Date = new Date()) => {
      const params = { location: location(issue.location), time: time(issue.createdAt) };
      const relation = dayRelation(issue.createdAt, now);
      if (relation === 'today') return t('issues.detail.reportedToday', params);
      if (relation === 'yesterday') return t('issues.detail.reportedYesterday', params);
      return t('issues.detail.reportedOn', { ...params, date: shortDate(casablancaDate(issue.createdAt)) });
    },
    [t, location, time, shortDate],
  );

  return useMemo(
    () => ({ location, time, shortDate, age, listLine, reportedLine }),
    [location, time, shortDate, age, listLine, reportedLine],
  );
}
