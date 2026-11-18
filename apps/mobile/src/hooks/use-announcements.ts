// Annonces (plan 08, étape 3) : requêtes et mutations TanStack Query.
// Toute clé de cache contient la résidence, envoyée explicitement avec `inResidence` (jamais la
// résidence active lue à l'envoi). Toute mutation invalide `announcementsQueryKey` : liste, dernière
// annonce (accueil) et détail se rafraîchissent ensemble.
import type {
  AnnouncementAudienceResponse,
  AnnouncementItem,
  AnnouncementListResponse,
  CreateAnnouncementInput,
  LatestAnnouncementResponse,
} from '@syndic/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { apiFetch, inResidence } from '@/lib/api';
import { mergeAnnouncementPages } from '@/lib/announcements';

const PAGE_SIZE = 20;

export const announcementsQueryKey = (residenceId: string) => ['announcements', residenceId] as const;

/**
 * Liste par pages (curseur) : épinglées d'abord, puis de la plus récente à la plus ancienne (l'ordre
 * vient de l'API). Une même annonce revue d'une page à l'autre n'est affichée qu'une fois.
 */
export function useAnnouncementList(residenceId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: [...announcementsQueryKey(residenceId ?? 'none'), 'list'],
    queryFn: ({ pageParam }) =>
      apiFetch<AnnouncementListResponse>(
        `/api/announcements?limit=${PAGE_SIZE}${pageParam === undefined ? '' : `&cursor=${encodeURIComponent(pageParam)}`}`,
        inResidence(residenceId),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: residenceId !== undefined,
  });

  const items = useMemo(() => mergeAnnouncementPages(query.data?.pages ?? []), [query.data]);

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

/** La plus récente annonce (carte « Dernière annonce » de l'accueil) : `null` s'il n'y en a aucune. */
export function useLatestAnnouncement(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...announcementsQueryKey(residenceId ?? 'none'), 'latest'],
    queryFn: async () =>
      (await apiFetch<LatestAnnouncementResponse>('/api/announcements/latest', inResidence(residenceId))).announcement,
    enabled: residenceId !== undefined,
  });
}

/** Détail d'une annonce. */
export function useAnnouncement(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: [...announcementsQueryKey(residenceId ?? 'none'), 'detail', id ?? 'none'],
    queryFn: () =>
      apiFetch<AnnouncementItem>(`/api/announcements/${encodeURIComponent(id ?? '')}`, inResidence(residenceId)),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

/** Nombre de membres qui seront prévenus (réservé à announcements.write : `enabled` à `false` sinon). */
export function useAnnouncementAudience(residenceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...announcementsQueryKey(residenceId ?? 'none'), 'audience'],
    queryFn: async () =>
      (await apiFetch<AnnouncementAudienceResponse>('/api/announcements/audience', inResidence(residenceId))).count,
    enabled: enabled && residenceId !== undefined,
  });
}

/**
 * Publie une annonce. Le succès attend le rafraîchissement des listes : à son retour, l'écran
 * précédent (liste, accueil) affiche déjà la nouvelle annonce.
 */
export function usePublishAnnouncement(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) =>
      apiFetch<AnnouncementItem>('/api/announcements', inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementsQueryKey(residenceId ?? 'none') }),
  });
}

/** Épingle ou désépingle (POST /api/announcements/:id/pin), idempotent. */
export function usePinAnnouncement(residenceId: string | undefined, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinned: boolean) =>
      apiFetch<AnnouncementItem>(
        `/api/announcements/${encodeURIComponent(id)}/pin`,
        inResidence(residenceId, { method: 'POST', body: JSON.stringify({ pinned }) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementsQueryKey(residenceId ?? 'none') }),
  });
}
