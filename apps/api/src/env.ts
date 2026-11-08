import { resolve } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

// .env.local est à la racine du monorepo (src/ et dist/ sont tous deux sous apps/api).
// En production, le fichier n'existe pas : les variables viennent de l'hébergeur.
config({ path: resolve(import.meta.dirname, '../../../.env.local'), quiet: true });

/** Une variable vide (`PORT=` dans .env.example) est traitée comme absente. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const envSchema = z.object({
  // Sans NODE_ENV, l'API se considère en production : les réglages de développement
  // (CORS ouvert, origines exp:// d'Expo Go) ne s'activent que sur demande explicite.
  NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('production')),
  PORT: optional(z.coerce.number().int().min(1).max(65535).default(3000)),
  /** Secret de signature des sessions Better Auth (32 caractères minimum). */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** URL publique de l'API (ex. http://localhost:3000) : base des routes /api/auth/*. */
  BETTER_AUTH_URL: z.url(),
  /**
   * En-tête rempli par le proxy de l'hébergeur avec l'IP du client (ex. `x-forwarded-for`).
   * À ne définir que derrière un proxy de confiance ; sinon, l'IP de la connexion est utilisée.
   */
  CLIENT_IP_HEADER: optional(z.string().min(1).toLowerCase().optional()),
  /** Cloudflare R2 (reçus, factures, photos) : identifiant du compte (32 caractères hexadécimaux). */
  R2_ACCOUNT_ID: optional(z.string().regex(/^[0-9a-f]{32}$/).optional()),
  /** Clé d'API R2 limitée au bucket (jamais affichée ni journalisée). */
  R2_ACCESS_KEY_ID: optional(z.string().min(16).optional()),
  R2_SECRET_ACCESS_KEY: optional(z.string().min(32).optional()),
  /** Bucket privé (ex. syndicapp-dev en développement). */
  R2_BUCKET: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/).optional()),
});

/** Variables de Cloudflare R2 : toutes renseignées, ou aucune (hors production). */
export const R2_VARIABLES = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

export type Env = z.infer<typeof envSchema>;

/**
 * Lit et vérifie les variables d'environnement. L'API refuse de démarrer si l'une est invalide.
 * Les messages ne contiennent que des noms de variables, jamais leurs valeurs.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Variables d'environnement invalides : ${names}`);
  }
  // En production, les cookies de session ne sont marqués Secure qu'avec une URL en HTTPS.
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.BETTER_AUTH_URL.startsWith('https://')) {
    throw new Error(
      'BETTER_AUTH_URL doit commencer par https:// en production (cookies de session sécurisés). ' +
        "Corrigez la variable chez l'hébergeur ; http:// n'est accepté qu'en développement et en test.",
    );
  }
  // R2 : obligatoire en production ; ailleurs, tout ou rien (une configuration partielle est une erreur).
  const missing = R2_VARIABLES.filter((name) => parsed.data[name] === undefined);
  if (
    missing.length > 0 &&
    (parsed.data.NODE_ENV === 'production' || missing.length < R2_VARIABLES.length)
  ) {
    throw new Error(`Variables d'environnement invalides : ${missing.join(', ')}`);
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
export const isProduction = env.NODE_ENV === 'production';
