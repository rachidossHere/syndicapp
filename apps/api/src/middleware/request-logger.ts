import type { MiddlewareHandler } from 'hono';

/**
 * Journal des requêtes : méthode, chemin sans paramètres de requête, statut et durée.
 * N'écrit jamais d'en-tête (dont Authorization), de paramètre de requête ni de corps,
 * qui peuvent contenir un jeton ou des données personnelles.
 */
export const requestLogger = (): MiddlewareHandler => async (c, next) => {
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
};
