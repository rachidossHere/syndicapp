// Endpoint de TEST réservé au développement : app.ts ne le monte pas quand NODE_ENV vaut production.
// Envoie une notification de test à l'utilisateur connecté, par le module notify comme toute autre.
import { db, schema } from '@syndic/db';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth, type AuthEnv } from '../middleware/require-auth';
import { notify } from '../notify';

export const devNotifications = new Hono<AuthEnv>();

/**
 * Notification de test (texte de « Nouvelle annonce », type `announcement`, préférences respectées)
 * à l'utilisateur connecté, dans sa résidence active la plus récente. Aucune résidence : 404.
 */
devNotifications.post('/test', requireAuth, async (c) => {
  const userId = c.get('user').id;
  const [membership] = await db
    .select({ residenceId: schema.membership.residenceId })
    .from(schema.membership)
    .where(and(eq(schema.membership.userId, userId), eq(schema.membership.active, true)))
    .orderBy(desc(schema.membership.createdAt))
    .limit(1);
  if (!membership) return c.json({ error: 'not_found' }, 404);
  const id = await notify(membership.residenceId, { kind: 'users', userIds: [userId] }, 'announcement');
  return c.json({ ok: true, id });
});
