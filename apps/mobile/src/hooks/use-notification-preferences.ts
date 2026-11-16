import type { NotificationPreferences, NotificationType } from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

/** Liées à l'utilisateur, pas à une résidence : la clé ne contient pas de résidence. */
export const NOTIFICATION_PREFERENCES_QUERY_KEY = ['notification-preferences'] as const;

/** Préférences de notification de l'utilisateur (GET /api/notification-preferences). */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: async () =>
      (await apiFetch<{ preferences: NotificationPreferences }>('/api/notification-preferences')).preferences,
  });
}

/** Change un type. Mise à jour immédiate de l'interrupteur, annulée si l'API refuse. */
export function useSetNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: NotificationType; enabled: boolean }) =>
      apiFetch('/api/notification-preferences', { method: 'PUT', body: JSON.stringify(input) }),
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY);
      if (previous) queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, { ...previous, [type]: enabled });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY }),
  });
}
