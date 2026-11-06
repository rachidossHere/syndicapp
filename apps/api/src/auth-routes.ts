/**
 * Routes de Better Auth (relatives à /api/auth).
 *
 * Seules les routes du MVP restent ouvertes. Toutes les autres sont désactivées
 * (`disabledPaths`) : modification du profil, du mot de passe ou de l'e-mail, suppression du
 * compte, réinitialisation et vérification d'e-mail, connexion sociale, gestion des sessions…
 * Elles contourneraient nos validations Zod (ex. un nom d'une lettre via /update-user, un mot
 * de passe de plus de 72 octets via /change-password).
 *
 * Toute route ouverte passe par nos validations ; une nouvelle route ne s'ouvre qu'avec accord
 * (AGENTS.md). Le test auth-routes.test.ts échoue si une mise à jour de Better Auth ajoute une
 * route qui n'est dans aucune des deux listes.
 */
export const OPEN_AUTH_PATHS = [
  '/sign-up/email',
  '/sign-in/email',
  '/sign-out',
  '/get-session',
  '/ok',
  '/error',
] as const;

export const DISABLED_AUTH_PATHS = [
  '/account-info',
  '/callback/:id',
  '/change-email',
  '/change-password',
  '/delete-user',
  '/delete-user/callback',
  '/expo-authorization-proxy',
  '/get-access-token',
  '/link-social',
  '/list-accounts',
  '/list-sessions',
  '/refresh-token',
  '/request-password-reset',
  '/reset-password',
  '/reset-password/:token',
  '/revoke-other-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/send-verification-email',
  '/sign-in/social',
  '/unlink-account',
  '/update-session',
  '/update-user',
  '/verify-email',
  '/verify-password',
] as const;
