import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';

import * as schema from './schema';

export type Database = NeonDatabase<typeof schema>;

let pool: Pool | undefined;
let instance: Database | undefined;

/**
 * Renvoie le client Drizzle, créé à la première utilisation.
 *
 * Pilote WebSocket de Neon (`Pool`) : il gère les **transactions** (`db.transaction`),
 * exigées par AGENTS.md pour toute opération qui touche l'argent, contrairement au pilote HTTP.
 * Node 22+ fournit `WebSocket` nativement : aucune bibliothèque `ws` n'est nécessaire.
 *
 * `DATABASE_URL` n'est lue qu'à ce moment-là : importer ce module ne nécessite pas de base,
 * ce qui permet à `typecheck` et aux tests sans base de tourner sans connexion.
 */
export function getDb(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL est absente : définissez-la dans .env.local à la racine (voir .env.example).',
    );
  }

  pool = new Pool({
    connectionString: url,
    // Neon coupe les connexions inactives (veille) : on ne garde pas longtemps une connexion
    // inutilisée, et on n'attend pas indéfiniment une connexion qui ne s'établit pas.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  // Une connexion inactive coupée par le réseau ou par Neon émet 'error' sur le pool : sans
  // gestionnaire, l'erreur est « non gérée » et peut arrêter le processus. Le pool la retire et en
  // ouvre une nouvelle à la prochaine requête. Journal : nom et code seulement, jamais de requête.
  pool.on('error', (error: Error & { code?: string }) => {
    console.error(`[db] connexion du pool perdue (${error.name}${error.code ? ` ${error.code}` : ''})`);
  });
  instance = drizzle({ client: pool, schema });
  return instance;
}

/** Ferme les connexions du pool (fin d'un script, d'un test ou arrêt du serveur). */
export async function closeDb(): Promise<void> {
  const current = pool;
  pool = undefined;
  instance = undefined;
  await current?.end();
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
