// Notifications push (plan 08) : types, jetons Expo et préférences.
// Les libellés affichés passent par les traductions de l'appli ; ce fichier ne contient que des codes.
import { z } from 'zod';

import { ROLES } from './roles';

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

/** Langues des textes de notification : celle de l'appli, envoyée avec le jeton. */
export const PUSH_LOCALES = ['fr', 'ar'] as const;
export type PushLocale = (typeof PUSH_LOCALES)[number];
export const DEFAULT_PUSH_LOCALE: PushLocale = 'fr';

export const registerPushTokenSchema = z.object({
  token: expoPushTokenSchema,
  /** Langue de l'appli (fr par défaut). */
  locale: z.enum(PUSH_LOCALES).default(DEFAULT_PUSH_LOCALE),
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

// --- Envoi (plan 08, étape 2) ------------------------------------------------------------------

/** Statut d'un envoi enregistré par `notify`. */
export const NOTIFICATION_JOB_STATUSES = ['pending', 'sent', 'failed'] as const;
export type NotificationJobStatus = (typeof NOTIFICATION_JOB_STATUSES)[number];

/** Nombre maximal de tentatives d'un envoi avant le statut `failed`. */
export const NOTIFICATION_MAX_ATTEMPTS = 3;

/**
 * À qui s'adresse une notification. Dans tous les cas, seuls les membres ACTIFS de la résidence
 * concernée la reçoivent (jamais quelqu'un d'une autre résidence).
 */
export const notificationAudienceSchema = z.discriminatedUnion('kind', [
  /** Tous les membres actifs. */
  z.object({ kind: z.literal('all') }),
  /** Les membres actifs ayant l'un de ces rôles. */
  z.object({ kind: z.literal('roles'), roles: z.array(z.enum(ROLES)).min(1) }),
  /** Ces utilisateurs précis, s'ils sont membres actifs. */
  z.object({ kind: z.literal('users'), userIds: z.array(z.string().min(1)).min(1) }),
  /** Les copropriétaires (rôle `owner`) actifs d'un lot. */
  z.object({ kind: z.literal('lot_owners'), lotId: z.uuid() }),
]);
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;

/**
 * Données jointes à la notification, pour ouvrir le bon écran : seulement l'identifiant de
 * l'élément (annonce, signalement, lot…). Jamais de texte, de nom ni de montant.
 */
export const notificationDataSchema = z.object({ itemId: z.uuid().optional() });
export type NotificationData = z.infer<typeof notificationDataSchema>;

/** Données réellement transmises à l'appli avec la notification. */
export type NotificationPayload = { type: NotificationType; residenceId: string; itemId?: string };
