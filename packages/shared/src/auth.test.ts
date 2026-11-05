import { describe, expect, it } from 'vitest';

import {
  AUTH_ERROR_KEY_LIST,
  AUTH_ERROR_KEYS,
  authFieldErrors,
  signInSchema,
  signUpRequestSchema,
  signUpSchema,
  utf8ByteLength,
} from './auth';

/** Lettre arabe « ب » : 1 caractère, 2 octets en UTF-8. */
const ARABIC_LETTER = 'ب';

const valid = {
  name: 'Rachid Tazi',
  email: 'rachid@exemple.ma',
  password: 'motdepasse',
  confirmPassword: 'motdepasse',
};

const errorsOf = (input: unknown) => {
  const result = signUpSchema.safeParse(input);
  return result.success ? {} : authFieldErrors(result.error);
};

describe('signUpSchema — mot de passe', () => {
  it('refuse 7 caractères', () => {
    expect(errorsOf({ ...valid, password: '1234567', confirmPassword: '1234567' })).toEqual({
      password: AUTH_ERROR_KEYS.passwordTooShort,
    });
  });

  it('accepte 8 caractères', () => {
    expect(signUpSchema.safeParse({ ...valid, password: '12345678', confirmPassword: '12345678' }).success).toBe(true);
  });

  it('accepte 36 lettres arabes (72 octets)', () => {
    const password = ARABIC_LETTER.repeat(36);
    expect(utf8ByteLength(password)).toBe(72);
    expect(signUpSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(true);
  });

  it('refuse 36 lettres arabes + 1 caractère latin (73 octets)', () => {
    const password = `${ARABIC_LETTER.repeat(36)}a`;
    expect(utf8ByteLength(password)).toBe(73);
    expect(password.length).toBe(37); // la longueur en caractères ne suffirait pas à le détecter
    expect(errorsOf({ ...valid, password, confirmPassword: password })).toEqual({
      password: AUTH_ERROR_KEYS.passwordTooLong,
    });
  });

  it('place l’erreur de confirmation sur confirmPassword', () => {
    expect(errorsOf({ ...valid, confirmPassword: 'autrechose' })).toEqual({
      confirmPassword: AUTH_ERROR_KEYS.passwordMismatch,
    });
  });

  it('signale la confirmation même si un autre champ est invalide', () => {
    expect(errorsOf({ ...valid, name: 'R', confirmPassword: 'autrechose' })).toEqual({
      name: AUTH_ERROR_KEYS.nameTooShort,
      confirmPassword: AUTH_ERROR_KEYS.passwordMismatch,
    });
  });
});

describe('signUpSchema — e-mail et nom', () => {
  it('nettoie un e-mail avec majuscules et espaces', () => {
    const result = signUpSchema.safeParse({ ...valid, email: '  Rachid.Tazi@Exemple.MA  ' });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('rachid.tazi@exemple.ma');
  });

  it('refuse un e-mail invalide', () => {
    expect(errorsOf({ ...valid, email: 'rachid@' })).toEqual({ email: AUTH_ERROR_KEYS.invalidEmail });
  });

  it('refuse un nom d’une seule lettre', () => {
    expect(errorsOf({ ...valid, name: 'R' })).toEqual({ name: AUTH_ERROR_KEYS.nameTooShort });
  });

  it('refuse un nom vide après nettoyage', () => {
    expect(errorsOf({ ...valid, name: '   ' })).toEqual({ name: AUTH_ERROR_KEYS.nameRequired });
  });

  it('nettoie le nom et accepte un nom arabe de 2 lettres', () => {
    expect(signUpSchema.safeParse({ ...valid, name: '  Rachid Tazi ' }).data?.name).toBe('Rachid Tazi');
    expect(signUpSchema.safeParse({ ...valid, name: 'بن' }).success).toBe(true);
  });

  it('refuse un nom de plus de 80 caractères', () => {
    expect(errorsOf({ ...valid, name: 'a'.repeat(81) })).toEqual({ name: AUTH_ERROR_KEYS.nameTooLong });
  });
});

describe('signUpRequestSchema (API)', () => {
  it('n’exige pas la confirmation, qui reste dans l’appli', () => {
    const { confirmPassword: _ignored, ...body } = valid;
    expect(signUpRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('n’applique aucune règle de longueur au mot de passe', () => {
    expect(signInSchema.safeParse({ email: valid.email, password: 'a' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: valid.email, password: 'ب'.repeat(100) }).success).toBe(true);
  });

  it('refuse un mot de passe vide', () => {
    const result = signInSchema.safeParse({ email: valid.email, password: '' });
    expect(result.success ? {} : authFieldErrors(result.error)).toEqual({
      password: AUTH_ERROR_KEYS.passwordRequired,
    });
  });
});

describe('erreurs', () => {
  it('ne renvoie que des clés de traduction, jamais la valeur saisie', () => {
    const secret = `${ARABIC_LETTER.repeat(36)}secret`;
    const fields = errorsOf({ ...valid, password: secret, confirmPassword: secret });
    expect(JSON.stringify(fields)).not.toContain('secret');
    for (const key of Object.values(fields)) expect(AUTH_ERROR_KEY_LIST).toContain(key);
  });

  it('renvoie une clé générique pour un corps mal formé', () => {
    expect(errorsOf('pas un objet')).toEqual({ form: AUTH_ERROR_KEYS.invalidInput });
  });
});
