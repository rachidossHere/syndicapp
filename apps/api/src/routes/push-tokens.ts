// Jetons push (plan 08, étape 1). Les jetons sont liés à l'utilisateur, pas à une résidence :
// exception assumée, seul requireAuth s'applique (pas d'en-tête X-Residence-Id) et chaque requête
// filtre sur l'utilisateur connecté. Un jeton n'est jamais renvoyé ni journalisé.
import { db, schema } from '@syndic/db';
import { NOTIFICATION_ERRORS, deletePushTokenSchema, registerPushTokenSchema } from '@syndic/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth, type AuthEnv } from '../middleware/require-auth';
import { parseJson } from '../validate';

export const pushTokens = new Hono<AuthEnv>();

/**
 * Enregistre ou met à jour le jeton du téléphone. Si le jeton appartenait à un autre utilisateur
 * (changement de compte sur le même téléphone), il est réattribué : l'unicité du jeton garantit
 * qu'un seul utilisateur le possède, et l'upsert est atomique.
 */
pushTokens.post('/', requireAuth, async (c) => {
  const input = await parseJson(c, registerPushTokenSchema);
  const now = new Date();
  await db
    .insert(schema.pushToken)
    .values({
      userId: c.get('user').id,
      token: input.token,
      device: input.device ?? null,
      locale: input.locale,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.pushToken.token,
      set: { userId: c.get('user').id, device: input.device ?? null, locale: input.locale, lastUsedAt: now },
    });
  return c.json({ ok: true });
});

/** Supprime le jeton donné, seulement s'il appartient à l'utilisateur (sinon 404, sans rien révéler). */
pushTokens.delete('/', requireAuth, async (c) => {
  const input = await parseJson(c, deletePushTokenSchema);
  const deleted = await db
    .delete(schema.pushToken)
    .where(and(eq(schema.pushToken.token, input.token), eq(schema.pushToken.userId, c.get('user').id)))
    .returning({ id: schema.pushToken.id });
  if (deleted.length === 0) {
    return c.json({ error: NOTIFICATION_ERRORS.tokenNotFound }, 404);
  }
  return c.json({ ok: true });
});
