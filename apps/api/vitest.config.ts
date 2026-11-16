import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Variables factices : aucun secret réel. Les tests d'intégration utilisent la branche Neon dev
// (DATABASE_URL de .env.local) et le bucket R2 de développement ; sans eux, ils sont ignorés.
//
// Deux groupes de tests :
// - « integration » : les fichiers qui lisent DATABASE_URL (base dev partagée). Exécutés l'un après
//   l'autre, sans parallélisme entre fichiers : ils ne se gênent pas (données, délais).
// - « unit » : tous les autres (sans base), exécutés en parallèle.
// Le classement est automatique : tout fichier de test qui mentionne `DATABASE_URL` (tous les tests
// d'intégration le lisent depuis .env.local) est d'intégration.
const INTEGRATION_FILES = readdirSync(resolve(import.meta.dirname, 'src'), { recursive: true })
  .map((file) => String(file).replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => readFileSync(resolve(import.meta.dirname, 'src', file), 'utf8').includes('DATABASE_URL'))
  .map((file) => `src/${file}`);

const shared = {
  env: {
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: 'secret-de-test-uniquement-pour-vitest-0123456789',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
  // Base distante (Neon, réveil possible) et premier rendu PDF : délais plus larges que les défauts.
  testTimeout: 30_000,
  hookTimeout: 60_000,
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: 'integration',
          include: INTEGRATION_FILES,
          fileParallelism: false,
        },
      },
      {
        test: {
          ...shared,
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: INTEGRATION_FILES,
        },
      },
    ],
  },
});
