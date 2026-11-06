import { AUTH_ERROR_KEYS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { toAuthResult } from './auth-errors';

describe('toAuthResult : erreurs de l’API → clés de traduction', () => {
  it('sans erreur : succès', () => {
    expect(toAuthResult(null, 'signIn')).toEqual({ ok: true });
  });

  it('400 validation_error : une clé par champ', () => {
    expect(
      toAuthResult(
        {
          status: 400,
          error: 'validation_error',
          fields: { password: 'auth.errors.passwordTooLong', email: 'auth.errors.invalidEmail' },
        },
        'signUp',
      ),
    ).toEqual({
      ok: false,
      fields: { password: AUTH_ERROR_KEYS.passwordTooLong, email: AUTH_ERROR_KEYS.invalidEmail },
    });
  });

  it('400 avec une clé inconnue : clé générique, jamais le texte reçu', () => {
    const result = toAuthResult(
      { status: 400, error: 'validation_error', fields: { name: 'texte brut du serveur' } },
      'signUp',
    );
    expect(result).toEqual({ ok: false, fields: { name: AUTH_ERROR_KEYS.invalidInput } });
  });

  it('401 à la connexion : identifiants incorrects', () => {
    expect(toAuthResult({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' }, 'signIn')).toEqual({
      ok: false,
      formError: AUTH_ERROR_KEYS.invalidCredentials,
    });
  });

  it('e-mail déjà utilisé à l’inscription : message neutre', () => {
    expect(toAuthResult({ status: 422, code: 'USER_ALREADY_EXISTS' }, 'signUp')).toEqual({
      ok: false,
      formError: AUTH_ERROR_KEYS.signUpFailed,
    });
  });

  it('429 : trop de tentatives, à la connexion comme à l’inscription', () => {
    for (const action of ['signIn', 'signUp'] as const) {
      expect(toAuthResult({ status: 429 }, action)).toEqual({
        ok: false,
        formError: AUTH_ERROR_KEYS.tooManyAttempts,
      });
    }
  });

  it('sans statut (réseau) : erreur réseau', () => {
    expect(toAuthResult({}, 'signIn')).toEqual({ ok: false, formError: AUTH_ERROR_KEYS.network });
  });

  it('500 : erreur inconnue', () => {
    expect(toAuthResult({ status: 500 }, 'signIn')).toEqual({
      ok: false,
      formError: AUTH_ERROR_KEYS.unknown,
    });
  });
});
