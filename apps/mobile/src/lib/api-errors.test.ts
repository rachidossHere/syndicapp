import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { apiErrorKey } from './api-errors';

describe('apiErrorKey', () => {
  it('renvoie la clé de refus d’invitation telle quelle', () => {
    expect(apiErrorKey(new ApiError(410, 'invitations.errors.expired'))).toBe('invitations.errors.expired');
    expect(apiErrorKey(new ApiError(404, 'invitations.errors.notFound'))).toBe('invitations.errors.notFound');
  });

  it('renvoie la clé de refus des charges telle quelle (409 traduits)', () => {
    expect(apiErrorKey(new ApiError(409, 'charges.errors.periodExists'))).toBe('charges.errors.periodExists');
    expect(apiErrorKey(new ApiError(409, 'charges.errors.amountExceedsRemaining'))).toBe(
      'charges.errors.amountExceedsRemaining',
    );
    expect(apiErrorKey(new ApiError(409, 'charges.errors.inventee'))).toBe('residences.errors.conflict');
  });

  it('renvoie la clé de refus des dépenses telle quelle (facture, date, fichier)', () => {
    expect(apiErrorKey(new ApiError(400, 'expenses.errors.fileTooLarge'))).toBe('expenses.errors.fileTooLarge');
    expect(apiErrorKey(new ApiError(0, 'network_error'))).toBe('auth.errors.network');
    expect(apiErrorKey(new ApiError(403, 'expenses.errors.uploadFailed'))).toBe('expenses.errors.uploadFailed');
    expect(apiErrorKey(new ApiError(400, 'expenses.errors.inventee'))).toBe('auth.errors.invalidInput');
  });

  it('ignore une clé inconnue envoyée par le serveur', () => {
    expect(apiErrorKey(new ApiError(410, 'invitations.errors.inventee'))).toBe('auth.errors.unknown');
  });

  it('déduit la clé du statut', () => {
    expect(apiErrorKey(new ApiError(0, 'network_error'))).toBe('auth.errors.network');
    expect(apiErrorKey(new ApiError(429, 'too_many_requests'))).toBe('auth.errors.tooManyAttempts');
    expect(apiErrorKey(new ApiError(403, 'forbidden'))).toBe('residences.errors.forbidden');
    expect(apiErrorKey(new ApiError(400, 'bad_request'))).toBe('auth.errors.invalidInput');
    expect(apiErrorKey(new ApiError(500, 'internal_error'))).toBe('auth.errors.unknown');
  });

  it('traite une erreur inconnue comme générique', () => {
    expect(apiErrorKey(new Error('x'))).toBe('auth.errors.unknown');
  });
});
