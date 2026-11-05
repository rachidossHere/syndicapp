import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'drizzle-kit';

// Les scripts db:* s'exécutent depuis packages/db : .env.local est à la racine du monorepo.
const envFile = resolve(process.cwd(), '../../.env.local');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema',
  out: './drizzle',
  // Seul le schéma public est géré par nos migrations ; neon_auth appartient à Neon.
  schemaFilter: ['public'],
  dbCredentials: {
    // Vide si absente : `db:generate` n'en a pas besoin, `db:migrate` et `db:studio` échoueront.
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
