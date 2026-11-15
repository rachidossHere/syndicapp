// Signalements (plan 07, étapes 2 et 3) : requêtes et mutations TanStack Query.
// Le filtre de la liste est envoyé tel quel à l'API (`status=open,in_progress`) ; les compteurs
// (par statut, urgents non résolus) viennent de GET /api/issues/counts. Toute mutation invalide
// `issuesQueryKey` : liste, compteurs et détail se rafraîchissent ensemble.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { apiFetch, inResidence } from '@/lib/api';
import { issueDeps } from '@/lib/issue-api';
import { saveIssue, type SaveIssueArgs } from '@/lib/issue-save';
import {
  filterStatusParam,
  type IssueCounts,
  type IssueDetail,
  type IssueFilter,
  type IssueItem,
  type IssueListPage,
  type IssueUpdatePlan,
} from '@/lib/issues';

const PAGE_SIZE = 20;

export const issuesQueryKey = (residenceId: string) => ['issues', residenceId] as const;

/** Les URL signées de photos vivent 5 minutes côté R2 : jamais gardées plus de 4 minutes. */
const PHOTO_URL_MAX_CACHE_MS = 4 * 60 * 1000;

/**
 * Liste d'un filtre, par pages : urgents non résolus d'abord, puis du plus récent au plus ancien
 * (l'ordre vient de l'API). Une même ligne revue d'une page à l'autre (un signalement créé entre
 * deux pages) n'est affichée qu'une fois.
 */
export function useIssueList(residenceId: string | undefined, filter: IssueFilter) {
  const status = filterStatusParam(filter);
  const query = useInfiniteQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'list', filter],
    queryFn: ({ pageParam }) =>
      apiFetch<IssueListPage>(
        `/api/issues?${status === undefined ? '' : `status=${status}&`}limit=${PAGE_SIZE}&offset=${pageParam}`,
        inResidence(residenceId),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return last.items.length > 0 && next < last.total ? next : undefined;
    },
    enabled: residenceId !== undefined,
  });

  const items = useMemo(() => {
    const byId = new Map<string, IssueItem>();
    for (const page of query.data?.pages ?? []) for (const item of page.items) byId.set(item.id, item);
    return [...byId.values()];
  }, [query.data]);

  return {
    items,
    /** Premier chargement terminé (jamais d'état vide avant). */
    loaded: query.data !== undefined,
    error: query.error,
    isRefetchError: query.isRefetchError,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

/** Compteurs de la résidence : par statut et urgents non résolus. */
export function useIssueCounts(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'counts'],
    queryFn: () => apiFetch<IssueCounts>('/api/issues/counts', inResidence(residenceId)),
    enabled: residenceId !== undefined,
  });
}

/** Détail d'un signalement avec son historique. */
export function useIssue(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'detail', id ?? 'none'],
    queryFn: () => apiFetch<IssueDetail>(`/api/issues/${encodeURIComponent(id ?? '')}`, inResidence(residenceId)),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

/** URL signée de la photo, demandée à l'ouverture et jamais gardée plus de 4 minutes. */
export function useIssuePhoto(residenceId: string | undefined, id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...issuesQueryKey(residenceId ?? 'none'), 'photo-url', id ?? 'none'],
    queryFn: async () =>
      (await apiFetch<{ url: string }>(`/api/issues/${encodeURIComponent(id ?? '')}/photo-url`, inResidence(residenceId))).url,
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
      apiFetch<unknown>(
        `/api/issues/${encodeURIComponent(id)}/comments`,
        inResidence(residenceId, { method: 'POST', body: JSON.stringify({ message }) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}

/** Réouverture par l'auteur (POST /api/issues/:id/reopen). */
export function useReopenIssue(residenceId: string | undefined, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<unknown>(`/api/issues/${encodeURIComponent(id)}/reopen`, inResidence(residenceId, { method: 'POST', body: '{}' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}

/**
 * Traitement par le personnel : changement de statut (POST /status, avec message facultatif) ou
 * message seul (POST /comments). Les listes, compteurs et le détail sont rafraîchis après coup.
 */
export function useUpdateIssue(residenceId: string | undefined, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: Exclude<IssueUpdatePlan, { kind: 'none' }>) =>
      plan.kind === 'status'
        ? apiFetch<unknown>(
            `/api/issues/${encodeURIComponent(id)}/status`,
            inResidence(residenceId, {
              method: 'POST',
              body: JSON.stringify({ status: plan.status, ...(plan.message === undefined ? {} : { message: plan.message }) }),
            }),
          )
        : apiFetch<unknown>(
            `/api/issues/${encodeURIComponent(id)}/comments`,
            inResidence(residenceId, { method: 'POST', body: JSON.stringify({ message: plan.message }) }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
  });
}
