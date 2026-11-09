import { defineConfig } from 'vitest/config';

// Tests des contraintes sur la branche Neon dev (DATABASE_URL de .env.local) ; sans base, ignorés.
export default defineConfig({
  test: {
    // Fichiers exécutés l'un après l'autre : ils partagent la même base dev.
    fileParallelism: false,
    // Base distante (Neon, réveil possible) et requêtes simultanées : délais plus larges que les défauts.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
