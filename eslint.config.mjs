// Configuration ESLint partagée par tous les packages du monorepo.
// Chaque package l'importe dans son propre eslint.config.mjs et y ajoute ses règles.
import prettier from 'eslint-config-prettier';

export const sharedIgnores = {
  ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/web-build/**'],
};

export default [sharedIgnores, prettier];
