import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

import { env } from './env';

/**
 * En-tête interne qui transmet l'adresse du client à Better Auth (limitation des tentatives).
 * Il est toujours réécrit par l'API : une valeur envoyée par le client est ignorée.
 */
export const CLIENT_IP_HEADER = 'x-syndic-client-ip';

export type ClientIpSource = {
  /**
   * Valeur de l'en-tête rempli par le proxy de confiance (CLIENT_IP_HEADER), si cet en-tête
   * est configuré. `undefined` : l'en-tête n'est pas configuré, on utilise la connexion.
   */
  trustedHeaderValue?: string | null;
  /** Adresse de la connexion TCP. */
  socketAddress?: string;
};

/**
 * Choisit l'adresse IP du client.
 * - En-tête de confiance configuré (derrière le proxy de l'hébergeur) : on prend la **dernière**
 *   adresse de la liste, celle qu'ajoute le proxy. Les précédentes viennent du client et peuvent
 *   être fausses (ex. `x-forwarded-for: 1.2.3.4` envoyé par un attaquant pour changer de compteur).
 * - Sinon : l'adresse de la connexion. L'en-tête x-forwarded-for n'est alors jamais lu.
 * Fonction pure, sans Hono : testée dans client-ip.test.ts.
 */
export function resolveClientIp({ trustedHeaderValue, socketAddress }: ClientIpSource): string | undefined {
  if (trustedHeaderValue !== undefined) {
    const entries = (trustedHeaderValue ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return entries.at(-1);
  }
  return socketAddress || undefined;
}

/** Adresse de la connexion TCP, ou `undefined` si elle n'est pas lisible (jamais d'exception). */
function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

/**
 * Adresse IP du client. Sans adresse, Better Auth partagerait un seul compteur de tentatives
 * entre tous les utilisateurs : d'où le réglage de CLIENT_IP_HEADER chez l'hébergeur (plan 12).
 */
export function clientIp(c: Context): string | undefined {
  if (env.CLIENT_IP_HEADER) {
    return resolveClientIp({ trustedHeaderValue: c.req.header(env.CLIENT_IP_HEADER) ?? null });
  }
  return resolveClientIp({ socketAddress: socketAddress(c) });
}

/** Copie la requête en y plaçant l'adresse du client dans l'en-tête interne. */
export function withClientIp(c: Context): Request {
  const headers = new Headers(c.req.raw.headers);
  headers.delete(CLIENT_IP_HEADER);
  const ip = clientIp(c);
  if (ip) headers.set(CLIENT_IP_HEADER, ip);
  return new Request(c.req.raw, { headers });
}
