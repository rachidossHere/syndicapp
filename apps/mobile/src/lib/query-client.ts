import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';

/** Client TanStack Query de l'appli. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // Pas de nouvel essai sur une erreur client (401 session expirée, 403, 404…).
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});
