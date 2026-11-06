import { defineConfig } from 'vitest/config';

// Variables factices : les tests de l'API tournent sans secret réel ni base de données
// (aucun test n'ouvre de connexion ; db est créée à la première requête seulement).
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'secret-de-test-uniquement-pour-vitest-0123456789',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
  },
});
