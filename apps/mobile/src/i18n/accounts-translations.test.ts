import { EXPENSE_CATEGORY_LABEL_KEYS, EXPENSE_ERRORS, ROLE_LABEL_KEYS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { arAccountTexts } from './ar-accounts';
import { fr } from './fr';
import { frAccountTexts } from './fr-accounts';
import { translate } from './translate';

const ARABIC_LETTER = /[؀-ۿ]/;
// Gabarit sans mot : « catégorie · date ».
const NO_WORDS = ['accounts.ledger.expenseLine'];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions des comptes (étape 4)', () => {
  const keys = Object.keys(frAccountTexts) as (keyof typeof frAccountTexts)[];

  it('chaque texte existe en français et en arabe, sans clé en trop', () => {
    expect(Object.keys(arAccountTexts).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      if (!NO_WORDS.includes(key)) expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les paramètres {…} sont les mêmes en français et en arabe', () => {
    for (const key of keys) {
      expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
    }
  });

  it('les clés d’erreur et de catégories utilisées par les écrans sont traduites', () => {
    const used = [...Object.values(EXPENSE_ERRORS), ...Object.values(EXPENSE_CATEGORY_LABEL_KEYS)];
    for (const key of used) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
    for (const key of Object.values(ROLE_LABEL_KEYS)) expect(ar[key], key).toMatch(ARABIC_LETTER);
  });

  it('textes de docs/depenses.png (écrans 1, 4, 5)', () => {
    expect(fr['accounts.title']).toBe('Comptes');
    expect(fr['accounts.balance.label']).toBe('Solde de la caisse');
    expect(fr['accounts.balance.note']).toBe('Mis à jour à chaque encaissement et dépense');
    expect(translate('fr', 'accounts.period.collected', { period: 'T4' })).toBe('Encaissé · T4');
    expect(translate('fr', 'accounts.period.spent', { period: 'T4' })).toBe('Dépensé · T4');
    expect(fr['accounts.ledger.title']).toBe('Mouvements');
    expect(fr['accounts.badge.noInvoice']).toBe('Sans facture');
    expect(fr['accounts.badge.cancelled']).toBe('Annulée');
    expect(translate('fr', 'accounts.ledger.paymentReceived', { lot: 'A21' })).toBe('Charge reçue · A21');
    expect(fr['accounts.invoice.view']).toBe('Voir la facture');
    expect(fr['accounts.cancel.button']).toBe('Annuler cette dépense');
    expect(fr['accounts.cancel.note']).toBe('Réservé au syndic et au trésorier · motif obligatoire');
    expect(fr['accounts.by.manager']).toBe('Le syndic');
    expect(fr['accounts.opening.title']).toBe('Solde de départ');
    expect(fr['accounts.opening.amount']).toBe('Montant en caisse');
    expect(fr['accounts.opening.date']).toBe('À la date du');
    expect(fr['accounts.opening.noticeTitle']).toBe('À saisir une seule fois');
    expect(fr['accounts.opening.save']).toBe('Enregistrer le solde de départ');
    expect(ar['accounts.title']).toBe('الحسابات');
    expect(ar['accounts.balance.label']).toBe('رصيد الصندوق');
    expect(ar['accounts.ledger.title']).toBe('الحركات');
    expect(ar['accounts.badge.noInvoice']).toBe('بدون فاتورة');
    expect(translate('ar', 'accounts.ledger.paymentReceived', { lot: 'A21' })).toBe('A21 · أداء مستلم');
  });

  it('l’annulation affiche « Annulée le … : motif » dans les deux langues', () => {
    const params = { date: '8 novembre 2026', reason: 'Saisie en double' };
    expect(translate('fr', 'accounts.cancelled.line', params)).toBe('Annulée le 8 novembre 2026 : Saisie en double');
    expect(translate('ar', 'accounts.cancelled.line', params)).toContain('Saisie en double');
  });
});
