import { defineConfig } from 'vitest/config';

// Variables factices : aucun secret réel. Les tests d'intégration utilisent la branche Neon dev
// (DATABASE_URL de .env.local) et le bucket R2 de développement ; sans eux, ils sont ignorés.
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'secret-de-test-uniquement-pour-vitest-0123456789',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
    // Les fichiers partagent la même base dev et le processeur (rendu PDF) : exécutés l'un après
    // l'autre, ils ne se gênent plus (plus de délai dépassé ni de données qui changent en cours de test).
    fileParallelism: false,
    // Base distante (Neon, réveil possible) et premier rendu PDF : délais plus larges que les défauts.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
