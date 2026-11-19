import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { announcementsQueryKey } from '@/hooks/use-announcements';
import { chargesQueryKey } from '@/hooks/use-charges';
import { cashQueryKey } from '@/hooks/use-expenses';
import { issuesQueryKey } from '@/hooks/use-issues';

/**
 * « Tirer pour actualiser » de l'accueil : relit tout ce que l'accueil affiche pour la résidence
 * (caisse, charges, signalements, annonces). Chaque clé contient la résidence : une autre résidence
 * n'est jamais touchée.
 */
export function useRefreshHome(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (residenceId === undefined) return;
    setRefreshing(true);
    try {
      await Promise.all(
        [cashQueryKey, chargesQueryKey, issuesQueryKey, announcementsQueryKey].map((key) =>
          queryClient.invalidateQueries({ queryKey: key(residenceId) }),
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, residenceId]);

  return { refresh, refreshing };
}
