import { authFieldErrors, signUpRequestSchema } from '@syndic/shared';
import { APIError, createAuthMiddleware } from 'better-auth/api';

/** Chemin de l'inscription par e-mail, relatif à basePath (/api/auth). */
const SIGN_UP_PATH = '/sign-up/email';

/**
 * Hook `before` de Better Auth : valide l'inscription avec le schéma partagé avant tout traitement.
 * En cas d'erreur : 400 `{ error: "validation_error", fields: { <champ>: <clé de traduction> } }`.
 * La réponse ne contient jamais les valeurs saisies (ni donc le mot de passe).
 * En cas de succès, le nom et l'e-mail nettoyés remplacent ceux reçus.
 */
export const validateSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGN_UP_PATH) return;

  const parsed = signUpRequestSchema.safeParse(ctx.body);
  if (!parsed.success) {
    throw new APIError('BAD_REQUEST', {
      error: 'validation_error',
      fields: authFieldErrors(parsed.error),
    });
  }

  return { context: { body: { ...ctx.body, ...parsed.data } } };
});
