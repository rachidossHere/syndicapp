import type { MiddlewareHandler } from 'hono';

const AUTH_PREFIX = '/api/auth/';

/**
 * Chemin journalisé. Pour /api/auth/*, seule l'action est gardée (`/api/auth/sign-in/…`) :
 * certaines routes de Better Auth portent un jeton dans le chemin (ex. réinitialisation).
 */
export function loggablePath(path: string): string {
  if (!path.startsWith(AUTH_PREFIX)) return path;
  const [action, ...rest] = path.slice(AUTH_PREFIX.length).split('/');
  return `${AUTH_PREFIX}${action ?? ''}${rest.length > 0 ? '/…' : ''}`;
}

/**
 * Journal des requêtes : méthode, chemin sans paramètres de requête, statut et durée.
 * N'écrit jamais d'en-tête (Cookie, Authorization…), de paramètre de requête ni de corps
 * (mots de passe des routes /api/auth/*), qui peuvent contenir un secret ou des données personnelles.
 */
export const requestLogger = (): MiddlewareHandler => async (c, next) => {
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  console.log(`${c.req.method} ${loggablePath(c.req.path)} ${c.res.status} ${ms}ms`);
};
