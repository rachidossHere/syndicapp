import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

import { env } from './env';

/**
 * En-tête interne qui transmet l'adresse du client à Better Auth (limitation des tentatives).
 * Il est toujours réécrit par l'API : une valeur envoyée par le client est ignorée.
 */
export const CLIENT_IP_HEADER = 'x-syndic-client-ip';

/**
 * Adresse IP du client.
 * - Derrière un proxy de confiance (hébergeur), `CLIENT_IP_HEADER` nomme l'en-tête qu'il remplit
 *   (ex. `x-forwarded-for`) : on prend la première adresse de la liste.
 * - Sinon (développement), l'adresse de la connexion TCP.
 * Sans adresse, Better Auth partagerait un seul compteur entre tous les utilisateurs.
 */
export function clientIp(c: Context): string | undefined {
  if (env.CLIENT_IP_HEADER) {
    return c.req.header(env.CLIENT_IP_HEADER)?.split(',')[0]?.trim() || undefined;
  }
  return getConnInfo(c).remote.address;
}

/** Copie la requête en y plaçant l'adresse du client dans l'en-tête interne. */
export function withClientIp(c: Context): Request {
  const headers = new Headers(c.req.raw.headers);
  headers.delete(CLIENT_IP_HEADER);
  const ip = clientIp(c);
  if (ip) headers.set(CLIENT_IP_HEADER, ip);
  return new Request(c.req.raw, { headers });
}
