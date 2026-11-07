import type {
  CreatedInvitation,
  InvitationPreview,
  PendingInvitation,
  Role,
} from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { setActiveResidenceId } from '@/lib/active-residence';
import { apiFetch } from '@/lib/api';

import { lotsQueryKey } from './use-lots';
import { RESIDENCES_QUERY_KEY } from './use-residences';

export const invitationsQueryKey = (residenceId: string) => ['invitations', residenceId] as const;

/** Invitations en attente de la résidence active (syndic uniquement : `members.invite`). */
export function usePendingInvitations(residenceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: invitationsQueryKey(residenceId ?? 'none'),
    queryFn: async () => (await apiFetch<{ invitations: PendingInvitation[] }>('/api/invitations')).invitations,
    enabled: enabled && residenceId !== undefined,
  });
}

export type NewInvitation = { role: Exclude<Role, 'manager'>; lotId?: string };

/** Création d'une invitation (POST /api/invitations). */
export function useCreateInvitation(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewInvitation) =>
      apiFetch<CreatedInvitation>('/api/invitations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      const id = residenceId ?? 'none';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invitationsQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: lotsQueryKey(id) }),
      ]);
    },
  });
}

/** Annulation d'une invitation (DELETE /api/invitations/:id). */
export function useCancelInvitation(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiFetch<void>(`/api/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      const id = residenceId ?? 'none';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invitationsQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: lotsQueryKey(id) }),
      ]);
    },
  });
}

/**
 * Aperçu d'un code complet (GET /api/invitations/preview/:code). Sans nouvel essai ni
 * actualisation automatique : chaque appel compte dans la limite de tentatives de l'API.
 */
export function useInvitationPreview(code: string | null) {
  return useQuery({
    queryKey: ['invitation-preview', code],
    queryFn: () => apiFetch<InvitationPreview>(`/api/invitations/preview/${code}`),
    enabled: code !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

type Accepted = { membershipId: string; residenceId: string; role: Role; lotId: string | null };

/** Acceptation (POST /api/invitations/accept/:code) : la résidence rejointe devient la résidence active. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<Accepted>(`/api/invitations/accept/${code}`, { method: 'POST' }),
    onSuccess: async (accepted) => {
      setActiveResidenceId(accepted.residenceId);
      await queryClient.invalidateQueries({ queryKey: RESIDENCES_QUERY_KEY });
    },
  });
}
