import type { CreateResidenceInput, Role } from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { setActiveResidenceId, useActiveResidenceId } from '@/lib/active-residence';
import { apiFetch } from '@/lib/api';

export const RESIDENCES_QUERY_KEY = ['residences'] as const;

/** Une résidence dont l'utilisateur est membre, avec son rôle (GET /api/residences). */
export type ResidenceSummary = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  role: Role;
};

/** Mes résidences actives et mon rôle dans chacune. */
export function useResidences(enabled = true) {
  return useQuery({
    queryKey: RESIDENCES_QUERY_KEY,
    queryFn: async () => (await apiFetch<{ residences: ResidenceSummary[] }>('/api/residences')).residences,
    enabled,
  });
}

/**
 * Résidence active : celle mémorisée sur le téléphone si l'utilisateur en est toujours membre,
 * sinon la première de sa liste. La mémorisation est corrigée une fois la liste connue
 * (résidence quittée, autre compte sur le même téléphone).
 */
export function useActiveResidence() {
  const query = useResidences();
  const storedId = useActiveResidenceId();
  const residences = query.data;
  const active = residences?.find((residence) => residence.id === storedId) ?? residences?.[0] ?? null;

  useEffect(() => {
    if (residences === undefined) return;
    const resolvedId = active?.id ?? null;
    if (resolvedId !== storedId) setActiveResidenceId(resolvedId);
  }, [residences, active?.id, storedId]);

  return { query, residences, active, setActive: setActiveResidenceId };
}

/** Création de la résidence : l'utilisateur en devient le syndic et elle devient la résidence active. */
export function useCreateResidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResidenceInput) =>
      apiFetch<ResidenceSummary>('/api/residences', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async (created) => {
      setActiveResidenceId(created.id);
      await queryClient.invalidateQueries({ queryKey: RESIDENCES_QUERY_KEY });
    },
  });
}
