import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { auth, type AuthSession } from '../auth';

/** Variables posées dans le contexte Hono par `requireAuth`. */
export type AuthEnv = {
  Variables: {
    user: AuthSession['user'];
    session: AuthSession['session'];
  };
};

/**
 * Exige une session Better Auth valide (cookie de session envoyé par l'appli).
 * Sans session : 401 `{ "error": "unauthorized" }`, via le gestionnaire d'erreurs global.
 * Avec session : `c.get('user')` et `c.get('session')` sont typés.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    throw new HTTPException(401);
  }
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});
