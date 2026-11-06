import { AUTH_ERROR_KEY_LIST, AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';

import { isFetchFailure } from './network-errors';

/** Résultat d'une action d'authentification : jamais de texte brut, seulement des clés de traduction. */
export type AuthResult =
  | { ok: true }
  | { ok: false; formError?: AuthErrorKey; fields?: Partial<Record<string, AuthErrorKey>> };

/** Forme des erreurs renvoyées par le client Better Auth (corps JSON de l'API + statut HTTP). */
type ClientError = {
  status?: number;
  statusText?: string;
  code?: string;
  error?: string;
  fields?: Record<string, unknown>;
};

const isAuthErrorKey = (value: unknown): value is AuthErrorKey =>
  typeof value === 'string' && (AUTH_ERROR_KEY_LIST as readonly string[]).includes(value);

/**
 * Convertit une erreur de l'API en clés de traduction.
 * - 400 `validation_error` : clés par champ (schéma partagé appliqué par l'API) ;
 * - 401 : identifiants incorrects (même message pour un e-mail inconnu) ;
 * - 429 : trop de tentatives ;
 * - erreur d'inscription (ex. e-mail déjà utilisé) : message neutre ;
 * - statut 0 ou absent : réseau.
 */
export function toAuthResult(error: ClientError | null | undefined, action: 'signIn' | 'signUp'): AuthResult {
  if (!error) return { ok: true };
  // Avant tout statut : une requête sans réponse (catchAllError renvoie un faux statut 500).
  if (isFetchFailure(error)) return { ok: false, formError: AUTH_ERROR_KEYS.network };

  const status = error.status ?? 0;

  if (status === 400 && error.error === 'validation_error' && error.fields) {
    const fields: Partial<Record<string, AuthErrorKey>> = {};
    for (const [field, key] of Object.entries(error.fields)) {
      fields[field] = isAuthErrorKey(key) ? key : AUTH_ERROR_KEYS.invalidInput;
    }
    return { ok: false, fields };
  }
  if (status === 429) return { ok: false, formError: AUTH_ERROR_KEYS.tooManyAttempts };
  if (action === 'signIn' && (status === 401 || status === 403)) {
    return { ok: false, formError: AUTH_ERROR_KEYS.invalidCredentials };
  }
  if (action === 'signUp' && status >= 400 && status < 500) {
    return { ok: false, formError: AUTH_ERROR_KEYS.signUpFailed };
  }
  return { ok: false, formError: AUTH_ERROR_KEYS.unknown };
}
