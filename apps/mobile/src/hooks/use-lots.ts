import type { BulkLotsResult, LotDeleteBlocker, LotStatus, LotType } from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, inResidence } from '@/lib/api';

export const lotsQueryKey = (residenceId: string) => ['lots', residenceId] as const;

export type Lot = {
  id: string;
  reference: string;
  building: string | null;
  floor: number | null;
  type: LotType;
  status: LotStatus;
  /** Ce qui empêche de supprimer l'appartement (membre, invitation, paiement, charge, signalement), ou `null`. */
  deleteBlocker: LotDeleteBlocker | null;
};

/** Lots de la résidence active, triés par référence, avec leur statut. */
export function useLots(residenceId: string | undefined) {
  return useQuery({
    queryKey: lotsQueryKey(residenceId ?? 'none'),
    queryFn: async () => (await apiFetch<{ lots: Lot[] }>('/api/lots', inResidence(residenceId))).lots,
    enabled: residenceId !== undefined,
  });
}

export type NewLot = { reference: string; building?: string; floor?: number };
export type BulkLots = { buildings: string[]; floorFrom: number; floorTo: number; perFloor: number };

/** Création d'un appartement (POST /api/lots). */
export function useCreateLot(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewLot) => apiFetch<unknown>('/api/lots', inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}

/** Génération rapide (POST /api/lots/bulk) : les références qui existent déjà sont ignorées. */
export function useCreateBulkLots(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkLots) =>
      apiFetch<BulkLotsResult>('/api/lots/bulk', inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}

/** Modification de la référence d'un appartement (PATCH /api/lots/:id). */
export function useUpdateLot(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      apiFetch<unknown>(`/api/lots/${id}`, inResidence(residenceId, { method: 'PATCH', body: JSON.stringify({ reference }) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}

/** Suppression d'un appartement vide (DELETE /api/lots/:id). */
export function useDeleteLot(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/lots/${id}`, inResidence(residenceId, { method: 'DELETE' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}
