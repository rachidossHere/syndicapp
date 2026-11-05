import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Renvoie le client Drizzle (pilote HTTP de Neon), créé à la première utilisation.
 * `DATABASE_URL` n'est lue qu'à ce moment-là : importer ce module ne nécessite pas de base,
 * ce qui permet à `typecheck` et aux tests de tourner sans connexion.
 */
export function getDb(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL est absente : définissez-la dans .env.local à la racine (voir .env.example).',
    );
  }

  instance = drizzle({ client: neon(url), schema });
  return instance;
}

/**
 * Client Drizzle partagé. Les accès sont relayés vers `getDb()`, donc l'erreur sur
 * `DATABASE_URL` n'apparaît qu'à la première requête, jamais à l'import.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDb();
    const value: unknown = Reflect.get(real, property, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
