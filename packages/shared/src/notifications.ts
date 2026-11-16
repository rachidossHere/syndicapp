// Notifications push (plan 08) : types, jetons Expo et préférences.
// Les libellés affichés passent par les traductions de l'appli ; ce fichier ne contient que des codes.
import { z } from 'zod';

/** Types de notification : l'utilisateur peut couper chacun, sauf `announcement_urgent`. */
export const NOTIFICATION_TYPES = [
  'announcement',
  'announcement_urgent',
  'issue_status',
  'issue_urgent',
  'charge_reminder',
  'payment_received',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Types qui ne peuvent jamais être coupés (annonces urgentes). */
export const LOCKED_NOTIFICATION_TYPES = ['announcement_urgent'] as const satisfies readonly NotificationType[];

export function isLockedNotificationType(type: NotificationType): boolean {
  return (LOCKED_NOTIFICATION_TYPES as readonly NotificationType[]).includes(type);
}

/** Clés de traduction des refus de l'API des notifications (réponse `{ error: <clé> }`). */
export const NOTIFICATION_ERRORS = {
  locked: 'notifications.errors.locked',
  tokenNotFound: 'notifications.errors.tokenNotFound',
} as const;

/** Jeton Expo : `ExponentPushToken[…]` (ou `ExpoPushToken[…]`). */
export const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,100}\]$/;

export const expoPushTokenSchema = z.string().trim().regex(EXPO_PUSH_TOKEN_PATTERN);

export const registerPushTokenSchema = z.object({
  token: expoPushTokenSchema,
  /** Nom de l'appareil (facultatif, affichage seulement). */
  device: z.string().trim().max(100).optional(),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const deletePushTokenSchema = z.object({ token: expoPushTokenSchema });
export type DeletePushTokenInput = z.infer<typeof deletePushTokenSchema>;

export const updateNotificationPreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  enabled: z.boolean(),
});
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

/** Préférences d'un utilisateur : tout est activé par défaut. */
export type NotificationPreferences = Record<NotificationType, boolean>;

export function defaultNotificationPreferences(): NotificationPreferences {
  return Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, true])) as NotificationPreferences;
}
