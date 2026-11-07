import { AUTH_ERROR_KEY_LIST } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { fr } from './fr';
import { translate } from './translate';

const ARABIC_LETTER = /[؀-ۿ]/;
const NO_WORDS = ['welcome.appName', 'home.residenceLine', 'lots.single.referencePlaceholder'];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions', () => {
  it('traduit chaque clé auth.errors.* de @syndic/shared en français et en arabe', () => {
    for (const key of AUTH_ERROR_KEY_LIST) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('a exactement les mêmes clés en français et en arabe', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
  });

  it('écrit chaque texte arabe en arabe (sauf le nom de l’appli)', () => {
    for (const [key, text] of Object.entries(ar)) {
      // Valeurs sans mot : nom de l'appli, ligne « nom · rôle » (deux paramètres), exemple de référence.
      if (NO_WORDS.includes(key)) continue;
      expect(text, key).toMatch(ARABIC_LETTER);
    }
  });

  it('garde les mêmes paramètres {…} dans les deux langues', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
    }
  });

  it('remplace les paramètres', () => {
    expect(translate('fr', 'home.greeting', { name: 'Rachid' })).toBe('Bonjour Rachid');
    expect(translate('ar', 'home.greeting', { name: 'رشيد' })).toBe('مرحبًا رشيد');
  });

  it('reprend les textes de docs/auth.png', () => {
    expect(fr['auth.errors.invalidCredentials']).toBe('E-mail ou mot de passe incorrect.');
    expect(fr['auth.errors.passwordTooShort']).toBe('Au moins 8 caractères.');
    expect(fr['auth.errors.passwordMismatch']).toBe('Les mots de passe ne correspondent pas.');
    expect(fr['auth.errors.signUpFailed']).toBe(
      'Impossible de créer ce compte. Si vous en avez déjà un, connectez-vous.',
    );
    expect(ar['auth.errors.invalidCredentials']).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  });
});
