import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export const ME_QUERY_KEY = ['me'] as const;

/** Réponse de GET /api/me : uniquement l'identifiant, le nom et l'e-mail. */
export type Me = { id: string; name: string; email: string };

/**
 * Utilisateur connecté, lu par notre API (GET /api/me) avec le cookie de session.
 * `enabled` : la requête ne part que si une session existe (sinon elle reste en attente,
 * ce qui n'est pas un chargement : voir le skill expo-data-fetching).
 */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<Me>('/api/me'),
    enabled,
  });
}
