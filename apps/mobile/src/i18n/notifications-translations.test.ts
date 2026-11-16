import { NOTIFICATION_ERRORS, NOTIFICATION_TYPES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { arNotificationTexts } from './ar-notifications';
import { fr } from './fr';
import { frNotificationTexts } from './fr-notifications';

const ARABIC_LETTER = /[؀-ۿ]/;
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions des notifications (plan 08, étape 1)', () => {
  const keys = Object.keys(frNotificationTexts) as (keyof typeof frNotificationTexts)[];

  it('chaque texte existe en français et en arabe (en lettres arabes), sans clé en trop', () => {
    expect(Object.keys(arNotificationTexts).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les paramètres {…} sont les mêmes dans les deux langues', () => {
    for (const key of keys) expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
  });

  it('chaque type de notification et chaque refus de l’API sont traduits', () => {
    for (const type of NOTIFICATION_TYPES) {
      for (const part of ['title', 'body'] as const) {
        const key = `notifications.type.${type}.${part}` as keyof typeof fr;
        expect(fr[key], `fr : ${key}`).toBeTruthy();
        expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
      }
    }
    for (const key of Object.values(NOTIFICATION_ERRORS)) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les textes d’écran ne contiennent ni montant ni nom d’exemple (rien n’apparaît sur l’écran verrouillé)', () => {
    expect(fr['notifications.intro.footnote']).toMatch(/Aucun montant ni nom/);
  });
});
