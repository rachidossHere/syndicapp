import { z } from 'zod';

/**
 * Clés de traduction des erreurs d'authentification. Les schémas ne renvoient jamais de texte :
 * l'appli traduit ces clés en français et en arabe (plan 03, étape 6).
 */
export const AUTH_ERROR_KEYS = {
  nameRequired: 'auth.errors.nameRequired',
  nameTooShort: 'auth.errors.nameTooShort',
  nameTooLong: 'auth.errors.nameTooLong',
  emailRequired: 'auth.errors.emailRequired',
  invalidEmail: 'auth.errors.invalidEmail',
  passwordRequired: 'auth.errors.passwordRequired',
  passwordTooShort: 'auth.errors.passwordTooShort',
  passwordTooLong: 'auth.errors.passwordTooLong',
  passwordMismatch: 'auth.errors.passwordMismatch',
  /** Requête mal formée (corps absent, champ inattendu) : erreur générique. */
  invalidInput: 'auth.errors.invalidInput',
  // Erreurs renvoyées par l'API, converties par l'appli (jamais affichées en texte brut).
  /** Connexion refusée : même message pour un e-mail inconnu et un mauvais mot de passe. */
  invalidCredentials: 'auth.errors.invalidCredentials',
  /** Inscription refusée (dont e-mail déjà utilisé) : message neutre, voir AGENTS.md section 8. */
  signUpFailed: 'auth.errors.signUpFailed',
  /** Trop de tentatives (429). */
  tooManyAttempts: 'auth.errors.tooManyAttempts',
  /** API injoignable (pas de réseau, serveur arrêté). */
  network: 'auth.errors.network',
  /** Toute autre erreur. */
  unknown: 'auth.errors.unknown',
} as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS];

/** Liste complète des clés, pour vérifier que chaque langue les traduit toutes. */
export const AUTH_ERROR_KEY_LIST: readonly AuthErrorKey[] = Object.values(AUTH_ERROR_KEYS);

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const PASSWORD_MIN_LENGTH = 8;
/** Limite de bcrypt : au-delà de 72 octets, la suite du mot de passe serait ignorée. */
export const PASSWORD_MAX_BYTES = 72;

/**
 * TextEncoder existe à l'exécution dans Node 22 (API) et dans Hermes (React Native, appli).
 * Il est lu sur globalThis avec un type local : ce package ne charge ni les types DOM ni ceux
 * de Node, et chaque consommateur le compile avec ses propres réglages.
 */
type Utf8Encoder = { encode(input: string): Uint8Array };
const encoder: Utf8Encoder = new (globalThis as unknown as { TextEncoder: new () => Utf8Encoder }).TextEncoder();

/** Taille d'un texte en octets UTF-8 (une lettre arabe = 2 octets). */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

/** Nombre de caractères (points de code) : une lettre accentuée ou arabe compte pour 1. */
const charCount = (value: string) => Array.from(value).length;

const nameSchema = z
  .string({ error: AUTH_ERROR_KEYS.nameRequired })
  .trim()
  .min(1, { error: AUTH_ERROR_KEYS.nameRequired })
  .refine((value) => charCount(value) >= NAME_MIN_LENGTH, { error: AUTH_ERROR_KEYS.nameTooShort })
  .refine((value) => charCount(value) <= NAME_MAX_LENGTH, { error: AUTH_ERROR_KEYS.nameTooLong });

const emailSchema = z
  .string({ error: AUTH_ERROR_KEYS.emailRequired })
  .trim()
  .toLowerCase()
  .min(1, { error: AUTH_ERROR_KEYS.emailRequired })
  .pipe(z.email({ error: AUTH_ERROR_KEYS.invalidEmail }));

/** Mot de passe d'inscription : 8 caractères minimum, 72 octets UTF-8 maximum. Jamais nettoyé. */
const newPasswordSchema = z
  .string({ error: AUTH_ERROR_KEYS.passwordRequired })
  .min(1, { error: AUTH_ERROR_KEYS.passwordRequired })
  .refine((value) => charCount(value) >= PASSWORD_MIN_LENGTH, {
    error: AUTH_ERROR_KEYS.passwordTooShort,
  })
  .refine((value) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES, {
    error: AUTH_ERROR_KEYS.passwordTooLong,
  });

/** Corps d'inscription reçu par l'API (la confirmation reste dans l'appli). */
export const signUpRequestSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

/** Formulaire d'inscription de l'appli. */
export const signUpSchema = signUpRequestSchema
  .extend({
    confirmPassword: z.string({ error: AUTH_ERROR_KEYS.passwordMismatch }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: AUTH_ERROR_KEYS.passwordMismatch,
    path: ['confirmPassword'],
    // Vérifiée même si un autre champ est invalide, pour afficher toutes les erreurs d'un coup.
    when: (payload) => {
      const value = payload.value as { password?: unknown; confirmPassword?: unknown };
      return typeof value.password === 'string' && typeof value.confirmPassword === 'string';
    },
  });

/**
 * Formulaire de connexion. Le mot de passe doit seulement être non vide :
 * aucune règle de longueur, pour ne rien révéler des règles d'inscription.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: AUTH_ERROR_KEYS.passwordRequired })
    .min(1, { error: AUTH_ERROR_KEYS.passwordRequired }),
});

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Erreurs par champ : la première clé de traduction de chaque champ.
 * Ne contient jamais la valeur saisie (ni donc le mot de passe).
 */
export function authFieldErrors(error: z.ZodError): Record<string, AuthErrorKey> {
  const fields: Record<string, AuthErrorKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    if (fields[field] !== undefined) continue;
    fields[field] = isAuthErrorKey(issue.message) ? issue.message : AUTH_ERROR_KEYS.invalidInput;
  }
  return fields;
}

function isAuthErrorKey(value: string): value is AuthErrorKey {
  return (AUTH_ERROR_KEY_LIST as readonly string[]).includes(value);
}
