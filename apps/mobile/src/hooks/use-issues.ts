// Signalements (plan 07, étape 2) : requêtes et mutations TanStack Query.
// « En cours » regroupe deux statuts (open, in_progress) : l'API filtre sur un seul statut, la liste
// fusionne donc deux requêtes paginées (lib/issues.ts : mergeIssues).
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { apiFetch } from '@/lib/api';
import { issueDeps } from '@/lib/issue-api';
import { saveIssue, type SaveIssueArgs } from '@/lib/issue-save';
import {
  filterStatuses,
  mergeIssues,
  type IssueCounts,
  type IssueDetail,
  type IssueFilter,
  type IssueListPage,
} from '@/lib/issues';
import type { IssueStatus } from '@syndic/shared';

const PAGE_SIZE = 20;

export const issuesQueryKey = (residenceId: string) => ['issues', residenceId] as const;

/** Les URL signées de photos vivent 5 minutes côté R2 : jamais gardées plus de 4 minutes. */
const PHOTO_URL_MAX_CACHE_MS = 4 * 60 * 1000;

function useIssuePages(residenceId: string | undefined, status: IssueStatus | undefined) {
  return useInfiniteQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'list', status ?? 'none'],
    queryFn: ({ pageParam }) =>
      apiFetch<IssueListPage>(`/api/issues?status=${status ?? 'open'}&limit=${PAGE_SIZE}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return last.items.length > 0 && next < last.total ? next : undefined;
    },
    enabled: residenceId !== undefined && status !== undefined,
  });
}

/**
 * Liste d'un filtre (« En cours » ou « Résolus »), les urgents non résolus en tête, et compteurs de
 * la résidence. Les deux requêtes sont toujours déclarées (règle des hooks) ; la seconde n'est
 * active que pour « En cours ».
 */
export function useIssueList(residenceId: string | undefined, filter: IssueFilter) {
  const statuses = filterStatuses(filter);
  const first = useIssuePages(residenceId, statuses[0]);
  const second = useIssuePages(residenceId, statuses[1]);
  const queries = statuses[1] === undefined ? [first] : [first, second];

  const items = useMemo(
    () => mergeIssues(queries.map((query) => query.data?.pages.flatMap((page) => page.items) ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [first.data, second.data, statuses.length],
  );
  const counts: IssueCounts | undefined = queries
    .map((query) => query.data?.pages.at(-1)?.counts)
    .find((value): value is IssueCounts => value !== undefined);

  // Stable : l'écran l'utilise pour rafraîchir au retour (useRefreshOnFocus). La seconde requête
  // n'est relancée que pour « En cours » (un refetch ignore `enabled`).
  const hasSecond = statuses[1] !== undefined;
  const refetchFirst = first.refetch;
  const refetchSecond = second.refetch;
  const refetch = useCallback(
    () => Promise.all(hasSecond ? [refetchFirst(), refetchSecond()] : [refetchFirst()]),
    [hasSecond, refetchFirst, refetchSecond],
  );

  const loaded = queries.every((query) => query.data !== undefined);
  return {
    items,
    counts,
    /** Premier chargement terminé (jamais d'état vide avant). */
    loaded,
    error: queries.find((query) => query.error)?.error ?? null,
    isRefetchError: queries.some((query) => query.isRefetchError),
    isFetching: queries.some((query) => query.isFetching),
    isRefetching: queries.some((query) => query.isRefetching && !query.isFetchingNextPage),
    isFetchingNextPage: queries.some((query) => query.isFetchingNextPage),
    isFetchNextPageError: queries.some((query) => query.isFetchNextPageError),
    hasNextPage: queries.some((query) => query.hasNextPage),
    fetchNextPage: () => {
      for (const query of queries) {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }
    },
    refetch,
  };
}

/** Détail d'un signalement avec son historique. */
export function useIssue(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'detail', id ?? 'none'],
    queryFn: () => apiFetch<IssueDetail>(`/api/issues/${encodeURIComponent(id ?? '')}`),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

/** URL signée de la photo, demandée à l'ouverture et jamais gardée plus de 4 minutes. */
export function useIssuePhoto(residenceId: string | undefined, id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'photo-url', id ?? 'none'],
    queryFn: async () =>
      (await apiFetch<{ url: string }>(`/api/issues/${encodeURIComponent(id ?? '')}/photo-url`)).url,
    enabled: enabled && residenceId !== undefined && id !== undefined,
    staleTime: PHOTO_URL_MAX_CACHE_MS - 60_000,
    gcTime: PHOTO_URL_MAX_CACHE_MS,
  });
}

export type NewIssue = Omit<SaveIssueArgs, 'deps'>;

/** Enregistre un signalement (photo vers R2 si besoin, puis création) et rafraîchit les listes. */
export function useCreateIssue(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewIssue) => saveIssue({ ...input, deps: issueDeps }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}

/** Commentaire de l'auteur (POST /api/issues/:id/comments). */
export function useCommentIssue(residenceId: string | undefined, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<unknown>(`/api/issues/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}

/** Réouverture par l'auteur (POST /api/issues/:id/reopen). */
export function useReopenIssue(residenceId: string | undefined, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<unknown>(`/api/issues/${encodeURIComponent(id)}/reopen`, { method: 'POST', body: '{}' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}
