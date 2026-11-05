import { getDb, sql } from '@syndic/db';
import { Hono } from 'hono';

/** Au-delà, la base est considérée comme indisponible (laisse le temps au réveil de Neon). */
const DB_TIMEOUT_MS = 5000;

export const health = new Hono();

// Seule route publique de l'API.
health.get('/', async (c) => {
  try {
    await withTimeout(getDb().execute(sql`select 1`), DB_TIMEOUT_MS);
    return c.json({ status: 'ok' }, 200);
  } catch (error) {
    console.error('[health] base de données indisponible :', error);
    return c.json({ status: 'error' }, 503);
  }
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`délai de ${ms} ms dépassé`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
