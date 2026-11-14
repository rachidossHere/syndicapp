import { AUTH_ERROR_KEYS } from '@syndic/shared';

import { fr, type TranslationKey } from '../i18n/fr';
import { ApiError } from './api-error';

/**
 * Clé de traduction d'une erreur de l'API. Les refus d'invitation et de charges arrivent déjà sous
 * forme de clé (`invitations.errors.*`, `charges.errors.*`) ; les autres se déduisent du statut. Jamais de texte de l'API affiché.
 */
export function apiErrorKey(error: unknown): TranslationKey {
  if (!(error instanceof ApiError)) return AUTH_ERROR_KEYS.unknown;
  if (error.status === 0) return AUTH_ERROR_KEYS.network;
  if (
    (error.code.startsWith('invitations.errors.') ||
      error.code.startsWith('charges.errors.') ||
      error.code.startsWith('expenses.errors.') ||
      error.code.startsWith('issues.errors.')) &&
    error.code in fr
  ) {
    return error.code as TranslationKey;
  }
  if (error.status === 429) return AUTH_ERROR_KEYS.tooManyAttempts;
  if (error.status === 403) return 'residences.errors.forbidden';
  if (error.status === 409) return 'residences.errors.conflict';
  if (error.status === 400) return AUTH_ERROR_KEYS.invalidInput;
  return AUTH_ERROR_KEYS.unknown;
}
