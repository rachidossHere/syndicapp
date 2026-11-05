import { Hono } from 'hono';

import { requireAuth, type AuthEnv } from '../middleware/require-auth';

export const me = new Hono<AuthEnv>();

/** Utilisateur connecté : uniquement `id`, `name` et `email` (jamais la session ni le jeton). */
me.get('/', requireAuth, (c) => {
  const { id, name, email } = c.get('user');
  return c.json({ id, name, email });
});
