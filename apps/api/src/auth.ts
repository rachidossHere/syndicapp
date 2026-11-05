// Configuration Better Auth : seul endroit où l'authentification est définie (AGENTS.md).
// Le schéma des tables (packages/db/src/schema/auth.ts) est généré à partir de ce fichier
// par la CLI de Better Auth : `pnpm --filter @syndic/api auth:generate`.
import { expo } from '@better-auth/expo';
import { db, schema } from '@syndic/db';
import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { env } from './env';

/** Coût bcrypt (plan 03) : 2^12 itérations. */
const BCRYPT_COST = 12;

/** Origines de confiance : le schéma de l'appli toujours, Expo Go en développement seulement. */
const APP_ORIGIN = 'syndicapp://';
const EXPO_GO_DEV_ORIGINS = ['exp://', 'exp://**', 'exp://192.168.*.*:*/**'];

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    // Pilote WebSocket de Neon : les écritures liées (utilisateur + compte) sont atomiques.
    transaction: true,
  }),

  emailAndPassword: {
    enabled: true,
    // Vérification de l'e-mail et mot de passe oublié : hors périmètre (pas de service d'envoi).
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    // Plafond en caractères ; la limite de 72 octets de bcrypt est vérifiée par Zod (plan 03, étape 4).
    maxPasswordLength: 72,
    password: {
      hash: (password) => bcrypt.hash(password, BCRYPT_COST),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },

  trustedOrigins: [APP_ORIGIN, ...(env.NODE_ENV === 'development' ? EXPO_GO_DEV_ORIGINS : [])],

  // Activé aussi en développement (désactivé par défaut hors production).
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
    },
  },

  // Aucune donnée envoyée à un service tiers (AGENTS.md, section 8).
  telemetry: { enabled: false },

  plugins: [expo()],
});

export type Auth = typeof auth;
export type AuthSession = typeof auth.$Infer.Session;
