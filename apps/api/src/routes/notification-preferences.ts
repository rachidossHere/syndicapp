// Préférences de notification (plan 08, étape 1). Liées à l'utilisateur, pas à une résidence :
// seul requireAuth s'applique, et tout est filtré sur l'utilisateur connecté.
import { db, schema } from '@syndic/db';
import {
  NOTIFICATION_ERRORS,
  defaultNotificationPreferences,
  isLockedNotificationType,
  updateNotificationPreferenceSchema,
} from '@syndic/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth, type AuthEnv } from '../middleware/require-auth';
import { parseJson } from '../validate';

export const notificationPreferences = new Hono<AuthEnv>();

/** Préférences de l'utilisateur : tout est activé par défaut, les types verrouillés le restent. */
notificationPreferences.get('/', requireAuth, async (c) => {
  const rows = await db
    .select({ type: schema.notificationPreference.type, enabled: schema.notificationPreference.enabled })
    .from(schema.notificationPreference)
    .where(eq(schema.notificationPreference.userId, c.get('user').id));
  const preferences = defaultNotificationPreferences();
  for (const row of rows) {
    if (!isLockedNotificationType(row.type)) preferences[row.type] = row.enabled;
  }
  return c.json({ preferences });
});

/** Change un type. Un type verrouillé (annonces urgentes) ne peut pas être coupé : 400. */
notificationPreferences.put('/', requireAuth, async (c) => {
  const input = await parseJson(c, updateNotificationPreferenceSchema);
  if (isLockedNotificationType(input.type) && !input.enabled) {
    return c.json({ error: NOTIFICATION_ERRORS.locked }, 400);
  }
  const userId = c.get('user').id;
  await db
    .insert(schema.notificationPreference)
    .values({ userId, type: input.type, enabled: input.enabled })
    .onConflictDoUpdate({
      target: [schema.notificationPreference.userId, schema.notificationPreference.type],
      set: { enabled: input.enabled, updatedAt: new Date() },
    });
  return c.json({ type: input.type, enabled: input.enabled });
});
