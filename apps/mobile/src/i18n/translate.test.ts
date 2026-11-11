import {
  AUTH_ERROR_KEY_LIST,
  CHARGE_ERRORS,
  CHARGE_PERIOD_LABEL_KEYS,
  EXPENSE_CATEGORY_LABEL_KEYS,
  EXPENSE_ERRORS,
  DUE_STATUS_LABEL_KEYS,
  INVITATION_ERRORS,
  PAYMENT_METHOD_LABEL_KEYS,
  ROLE_LABEL_KEYS,
} from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { fr } from './fr';
import { EXPENSE_FORM_ERRORS } from '../lib/expense-form';
import { translate } from './translate';

const ARABIC_LETTER = /[؀-ۿ]/;
const NO_WORDS = [
  'welcome.appName',
  'home.residenceLine',
  'lots.single.referencePlaceholder',
  // Gabarits sans mot : période « {mois} {année} », dates, ligne « {mode} · {date} ».
  'charges.period.month',
  'charges.date.short',
  'charges.date.long',
  'charges.payment.line',
  'expenses.field.currency',
  'expenses.date.display',
  'accounts.ledger.expenseLine',
];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions', () => {
  it('traduit chaque clé auth.errors.* de @syndic/shared en français et en arabe', () => {
    for (const key of AUTH_ERROR_KEY_LIST) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('traduit les clés de charges de @syndic/shared (erreurs, statuts, modes, périodicités)', () => {
    const keys = [
      ...Object.values(CHARGE_ERRORS),
      ...Object.values(CHARGE_PERIOD_LABEL_KEYS),
      ...Object.values(DUE_STATUS_LABEL_KEYS),
      ...Object.values(PAYMENT_METHOD_LABEL_KEYS),
    ];
    for (const key of keys) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('traduit les refus d’invitation et les rôles de @syndic/shared', () => {
    const keys = [...Object.values(INVITATION_ERRORS), ...Object.values(ROLE_LABEL_KEYS)];
    for (const key of keys) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('libellés des périodes de docs/charges.png', () => {
    expect(translate('fr', 'charges.period.quarter4', { year: 2026 })).toBe('4e trimestre 2026');
    expect(translate('ar', 'charges.period.quarter4', { year: 2026 })).toBe('الربع الرابع 2026');
    expect(translate('fr', 'charges.period.month', { month: fr['charges.months.11'], year: 2026 })).toBe('Novembre 2026');
    expect(translate('ar', 'charges.period.month', { month: ar['charges.months.11'], year: 2026 })).toBe('نونبر 2026');
    expect(fr['charges.errors.periodExists']).toBe('Cet appel de charges existe déjà.');
  });

  it('textes de « Mes charges » (écrans 5 et 7 de docs/charges.png)', () => {
    expect(translate('fr', 'mine.payBefore', { date: '15 décembre' })).toBe(
      'À régler avant le 15 décembre, en espèces ou par virement au syndic.',
    );
    expect(translate('ar', 'mine.payBefore', { date: '15 دجنبر' })).toBe(
      'يجب الأداء قبل 15 دجنبر، نقدًا أو بتحويل إلى وكيل الإقامة.',
    );
    expect(ar['mine.title']).toBe('مصاريفي');
    expect(translate('fr', 'receipt.title', { number: '2026-0042' })).toBe('Reçu n° 2026-0042');
    expect(fr['mine.emptyTitle']).toBe('Aucune charge pour l’instant');
  });

  it('traduit les textes de l’ajout de dépense (erreurs, catégories, formulaire)', () => {
    const keys = [
      ...Object.values(EXPENSE_ERRORS),
      ...Object.values(EXPENSE_CATEGORY_LABEL_KEYS),
      ...Object.values(EXPENSE_FORM_ERRORS),
    ];
    for (const key of keys) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
    // Aucune clé expenses.errors.* sans origine connue (API ou formulaire).
    const known = new Set<string>([...Object.values(EXPENSE_ERRORS), ...Object.values(EXPENSE_FORM_ERRORS)]);
    for (const key of Object.keys(fr).filter((k) => k.startsWith('expenses.errors.'))) {
      expect(known.has(key), key).toBe(true);
    }
  });

  it('textes de docs/depenses.png (écrans 2 et 3)', () => {
    expect(fr['expenses.add.title']).toBe('Nouvelle dépense');
    expect(fr['expenses.invoice.take']).toBe('Prendre la facture en photo');
    expect(fr['expenses.invoice.or']).toBe('ou choisir une image ou un PDF');
    expect(fr['expenses.invoice.added']).toBe('Facture ajoutée');
    expect(fr['expenses.field.label']).toBe('Pour quoi ?');
    expect(fr['expenses.field.category']).toBe('Catégorie');
    expect(fr['expenses.submit']).toBe('Enregistrer la dépense');
    expect(translate('fr', 'expenses.uploading', { percent: 64 })).toBe('Envoi de la facture… 64 %');
    expect(fr['expenses.note.withInvoice']).toBe('Visible par tous les copropriétaires, avec sa facture.');
    expect(fr['expenses.toast.withInvoice']).toBe('Dépense enregistrée avec facture · visible par tous');
    expect(fr['expenses.category.maintenance']).toBe('Entretien');
    expect(ar['expenses.category.repairs']).toBe('إصلاحات');
    expect(translate('fr', 'expenses.date.display', { day: 8, month: fr['charges.dateMonthsShort.11'], year: 2026 })).toMatch(
      /^8 nov/,
    );
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
