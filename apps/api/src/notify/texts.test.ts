// Les textes de notification sont visibles sur l'écran verrouillé : fixes et génériques (plan 08).
import { NOTIFICATION_TYPES, PUSH_LOCALES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { notificationText } from './texts';

describe('textes des notifications', () => {
  it('chaque type a un texte FR et AR, sans chiffre (ni montant, ni numéro de lot)', () => {
    for (const type of NOTIFICATION_TYPES) {
      for (const locale of PUSH_LOCALES) {
        const { title, body } = notificationText(type, locale);
        expect({ type, locale, ok: body.length > 3 }).toEqual({ type, locale, ok: true });
        expect(`${title} ${body}`).not.toMatch(/[0-9٠-٩]/);
      }
    }
  });

  it('le texte ne dépend que du type et de la langue (aucune donnée de l’appelant)', () => {
    expect(notificationText.length).toBe(2);
    expect(notificationText('announcement', 'fr').body).toBe('Nouvelle annonce dans votre résidence');
    expect(notificationText('announcement_urgent', 'fr').body).toBe('Annonce urgente dans votre résidence');
    expect(notificationText('issue_status', 'fr').body).toBe('Votre signalement a été mis à jour');
    expect(notificationText('charge_reminder', 'fr').body).toBe('Un rappel de charges vous attend dans SyndicApp');
    expect(notificationText('announcement', 'ar').body).not.toBe(notificationText('announcement', 'fr').body);
  });
});
