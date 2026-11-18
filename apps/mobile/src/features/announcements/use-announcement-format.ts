import { useCallback, useMemo } from 'react';

import { useIssueFormat } from '@/features/issues/use-issue-format';
import { useT } from '@/i18n/use-t';
import { announcementWhen, authorLabelKey, type AnnouncementItem } from '@/lib/announcements';

/** Libellés des annonces (« Le syndic · hier ») dans la langue active. L'auteur n'est jamais nommé. */
export function useAnnouncementFormat() {
  const t = useT();
  const { time, shortDate } = useIssueFormat();

  /** « aujourd'hui à 8 h 30 », « hier » ou « 10 nov. ». */
  const when = useCallback(
    (instant: string, now?: Date) => {
      const value = announcementWhen(instant, now);
      switch (value.kind) {
        case 'today':
          return t('announcements.when.today', { time: time(instant) });
        case 'yesterday':
          return t('announcements.when.yesterday');
        case 'date':
          return shortDate(value.date);
      }
    },
    [t, time, shortDate],
  );

  /** « Le syndic · hier » (ou la date seule quand le rôle de l'auteur n'est pas connu). */
  const meta = useCallback(
    (item: Pick<AnnouncementItem, 'authorRole' | 'createdAt'>, now?: Date) => {
      const authorKey = authorLabelKey(item.authorRole);
      const text = when(item.createdAt, now);
      return authorKey === undefined ? text : t('announcements.meta', { author: t(authorKey), when: text });
    },
    [t, when],
  );

  return useMemo(() => ({ when, meta }), [when, meta]);
}
