import { createMiddleware } from 'hono/factory';

import { clientIp } from './client-ip';
import type { AuthEnv } from './middleware/require-auth';

/**
 * Limiteur de tentatives en mémoire (fenêtre fixe). Comme celui de la connexion, il repart à zéro
 * au redémarrage et ne vaut que pour une instance (AGENTS.md section 9, à revoir au plan 12).
 */
export function createAttemptLimiter({
  max,
  windowMs,
  now = Date.now,
}: {
  max: number;
  windowMs: number;
  now?: () => number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    /** Enregistre une tentative. Renvoie les secondes à attendre si la limite est dépassée. */
    hit(key: string): { allowed: true } | { allowed: false; retryAfter: number } {
      const time = now();
      if (buckets.size > 10_000) {
        for (const [k, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(k);
      }
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= time) {
        bucket = { count: 0, resetAt: time + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > max) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)),
        };
      }
      return { allowed: true };
    },
    reset() {
      buckets.clear();
    },
  };
}

/** 10 tentatives par minute, par utilisateur et par IP, sur l'aperçu et l'acceptation des codes. */
export const inviteAttempts = createAttemptLimiter({ max: 10, windowMs: 60_000 });

/**
 * Après `requireAuth`. Deux compteurs : l'utilisateur, et l'IP du client (si elle est connue ; sans
 * IP, un compteur commun bloquerait tout le monde à la fois). Dépassement : 429.
 */
export const limitInviteAttempts = createMiddleware<AuthEnv>(async (c, next) => {
  const ip = clientIp(c);
  const keys = [`user:${c.get('user').id}`, ...(ip ? [`ip:${ip}`] : [])];
  // Les deux compteurs sont toujours incrémentés.
  const results = keys.map((key) => inviteAttempts.hit(key));
  const blocked = results.find((result) => !result.allowed);
  if (blocked && !blocked.allowed) {
    return c.json({ error: 'too_many_requests' }, 429, {
      'Retry-After': String(blocked.retryAfter),
    });
  }
  await next();
});
