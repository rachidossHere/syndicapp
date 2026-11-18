import { describe, expect, it } from 'vitest';

import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import unpaidScreenSource from '../features/charges/unpaid-screen.tsx?raw';
import { translate } from '../i18n/translate';
import {
  formatReminderLine,
  isCoolingDown,
  isUnpaid,
  remindableCount,
  reminderAgo,
  reminderButtonState,
  reminderToastKey,
  type ReminderDue,
} from './reminders';

// « Aujourd'hui » : 16 novembre 2026, 10 h à Casablanca (UTC+1).
const NOW = new Date('2026-11-16T09:00:00Z');
const at = (iso: string) => iso;

const never: ReminderDue = { status: 'unpaid', lastReminderAt: null, nextReminderAt: null };
const recent: ReminderDue = {
  status: 'unpaid',
  lastReminderAt: at('2026-11-15T10:00:00Z'), // hier
  nextReminderAt: at('2026-11-18T10:00:00Z'), // dans 2 jours
};
const expired: ReminderDue = {
  status: 'partial',
  lastReminderAt: at('2026-11-12T10:00:00Z'),
  nextReminderAt: null, // l'API ne donne plus de prochaine date une fois la limite passée
};

describe('boutons de relance selon l’état du lot', () => {
  it('jamais relancé, ou limite passée : « Relancer » actif', () => {
    expect(reminderButtonState(never, NOW)).toBe('remind');
    expect(reminderButtonState(expired, NOW)).toBe('remind');
    // Prochaine date déjà dépassée (écran resté ouvert) : de nouveau actif.
    expect(reminderButtonState({ ...recent, nextReminderAt: '2026-11-16T08:00:00Z' }, NOW)).toBe(
      'remind',
    );
  });

  it('relancé il y a moins de 3 jours : « Relancé » désactivé', () => {
    expect(reminderButtonState(recent, NOW)).toBe('reminded');
    expect(isCoolingDown(recent, NOW)).toBe(true);
  });

  it('lot payé : aucun bouton ; dû sans données de relance (autre rôle) : « Relancer »', () => {
    expect(reminderButtonState({ status: 'paid' }, NOW)).toBe('none');
    expect(isUnpaid({ status: 'paid' })).toBe(false);
    expect(reminderButtonState({ status: 'unpaid' }, NOW)).toBe('remind');
  });

  it('« Relancer tous les impayés (N) » ne compte que les lots réellement relançables', () => {
    // Comme l'écran 6 : A12 impayé, B31 partiel, A21 impayé déjà relancé hier → N = 2.
    expect(remindableCount([never, { ...never, status: 'partial' }, recent], NOW)).toBe(2);
    expect(remindableCount([recent], NOW)).toBe(0);
    expect(remindableCount([{ status: 'paid' }, expired], NOW)).toBe(1);
    expect(remindableCount([], NOW)).toBe(0);
  });
});

describe('quand a eu lieu la dernière relance', () => {
  it('aujourd’hui, hier, il y a N jours (calendrier de Casablanca)', () => {
    expect(reminderAgo('2026-11-16T07:00:00Z', NOW)).toEqual({ kind: 'today' });
    expect(reminderAgo('2026-11-15T22:30:00Z', NOW)).toEqual({ kind: 'yesterday' }); // 23 h 30 à Casablanca la veille
    expect(reminderAgo('2026-11-14T10:00:00Z', NOW)).toEqual({ kind: 'days', count: 2 });
    expect(reminderAgo('2026-11-13T10:00:00Z', NOW)).toEqual({ kind: 'days', count: 3 });
  });
});

describe('texte « Relancé… nouvelle relance possible le … »', () => {
  it('français : « Relancé hier · nouvelle relance possible le 17 nov. »', () => {
    expect(formatReminderLine('fr', '2026-11-15T10:00:00Z', '2026-11-18T10:00:00Z', NOW)).toBe(
      'Relancé hier · nouvelle relance possible le 18 nov.',
    );
    expect(formatReminderLine('fr', '2026-11-14T10:00:00Z', '2026-11-17T10:00:00Z', NOW)).toBe(
      'Relancé il y a 2 jours · nouvelle relance possible le 17 nov.',
    );
    expect(formatReminderLine('fr', '2026-11-16T07:00:00Z', '2026-11-19T07:00:00Z', NOW)).toBe(
      'Relancé aujourd’hui · nouvelle relance possible le 19 nov.',
    );
  });

  it('la date est celle de Casablanca (23 h 30 UTC = minuit passé au Maroc)', () => {
    expect(formatReminderLine('fr', '2026-11-14T10:00:00Z', '2026-11-17T23:30:00Z', NOW)).toContain(
      'le 18 nov.',
    );
  });

  it('arabe : même structure, lettres arabes', () => {
    const line = formatReminderLine('ar', '2026-11-15T10:00:00Z', '2026-11-18T10:00:00Z', NOW);
    expect(line).toMatch(/[؀-ۿ]/);
    expect(line).toContain('تم التذكير أمس');
    expect(line).toContain('18');
  });
});

describe('toast après l’envoi', () => {
  it('singulier, pluriel et aucun lot', () => {
    expect(reminderToastKey(1)).toBe('one');
    expect(reminderToastKey(2)).toBe('many');
    expect(reminderToastKey(24)).toBe('many');
    expect(reminderToastKey(0)).toBe('none');
    expect(translate('fr', 'charges.unpaid.toastOne')).toBe('Rappel envoyé à 1 lot');
    expect(translate('fr', 'charges.unpaid.toastMany', { count: 2 })).toBe(
      'Rappel envoyé à 2 lots',
    );
    expect(translate('ar', 'charges.unpaid.toastOne')).toMatch(/[؀-ۿ]/);
    expect(translate('ar', 'charges.unpaid.toastMany', { count: 2 })).toContain('2');
  });
});

describe('traductions des relances (FR et AR)', () => {
  const keys = Object.keys(fr).filter(
    (key) =>
      key.startsWith('charges.unpaid.') ||
      key.startsWith('notifications.simulate.') ||
      key.startsWith('charges.errors.reminder') ||
      key === 'charges.detail.unpaidReminders',
  ) as (keyof typeof fr)[];
  const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

  it('chaque texte existe en français et en arabe (lettres arabes), avec les mêmes paramètres', () => {
    expect(keys.length).toBeGreaterThan(25);
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      expect(ar[key], `ar : ${key}`).toMatch(/[؀-ۿ]/);
      expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
    }
  });

  it('les textes demandés par le plan', () => {
    expect(fr['charges.unpaid.remindAll']).toBe('Relancer tous les impayés ({count})');
    expect(fr['charges.unpaid.note']).toBe(
      'Une relance par lot tous les 3 jours au maximum. Seuls les copropriétaires du lot la reçoivent.',
    );
    expect(fr['charges.unpaid.remind']).toBe('Relancer');
    expect(fr['charges.unpaid.reminded']).toBe('Relancé');
  });
});

describe('écran « Impayés » : composants du design system', () => {
  it('Amount et StatusBadge pour les montants et statuts, confirmation avant « Relancer tous »', () => {
    expect(unpaidScreenSource).toContain('<Amount');
    expect(unpaidScreenSource).toContain('<StatusBadge');
    expect(unpaidScreenSource).toContain('<Sheet');
    expect(unpaidScreenSource).toContain('setConfirming(true)');
  });

  it('aucune couleur, taille ni côté codés en dur', () => {
    expect(unpaidScreenSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(unpaidScreenSource).not.toMatch(
      /\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight)\b/,
    );
    expect(unpaidScreenSource).not.toMatch(/fontSize|borderRadius/);
  });
});
