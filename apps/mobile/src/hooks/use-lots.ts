import type { LotStatus, LotType } from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export const lotsQueryKey = (residenceId: string) => ['lots', residenceId] as const;

export type Lot = {
  id: string;
  reference: string;
  building: string | null;
  floor: number | null;
  type: LotType;
  status: LotStatus;
};

/** Lots de la résidence active, triés par référence, avec leur statut. */
export function useLots(residenceId: string | undefined) {
  return useQuery({
    queryKey: lotsQueryKey(residenceId ?? 'none'),
    queryFn: async () => (await apiFetch<{ lots: Lot[] }>('/api/lots')).lots,
    enabled: residenceId !== undefined,
  });
}

export type NewLot = { reference: string; building?: string; floor?: number };
export type BulkLots = { buildings: string[]; floorFrom: number; floorTo: number; perFloor: number };

/** Création d'un appartement (POST /api/lots). */
export function useCreateLot(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewLot) => apiFetch<unknown>('/api/lots', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}

/** Génération rapide (POST /api/lots/bulk) : tout ou rien. */
export function useCreateBulkLots(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkLots) =>
      apiFetch<{ count: number }>('/api/lots/bulk', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lotsQueryKey(residenceId ?? 'none') }),
  });
}
