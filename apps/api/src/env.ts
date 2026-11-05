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
  NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('development')),
  PORT: optional(z.coerce.number().int().min(1).max(65535).default(3000)),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Seuls les noms de variables sont affichés, jamais leurs valeurs.
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Variables d'environnement invalides : ${names}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
