import { ISSUE_ERRORS, ISSUE_LOCATION_LABEL_KEYS, ISSUE_LOCATIONS, ISSUE_STATUS_LABEL_KEYS, ISSUE_STATUSES, ROLE_LABEL_KEYS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ISSUE_FORM_ERRORS } from '../lib/issues';
import { ar } from './ar';
import { arIssueTexts } from './ar-issues';
import { fr } from './fr';
import { frIssueTexts } from './fr-issues';
import { translate } from './translate';

const ARABIC_LETTER = /[؀-ۿ]/;
// Gabarits sans mot propre : « emplacement · âge », « message · heure »…
const NO_WORDS = ['issues.line', 'issues.time', 'issues.event.detail', 'issues.event.titleBy', 'issues.age.date', 'issues.event.quote'];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions des signalements (plan 07, étape 2)', () => {
  const keys = Object.keys(frIssueTexts) as (keyof typeof frIssueTexts)[];

  it('chaque texte existe en français et en arabe, sans clé en trop', () => {
    expect(Object.keys(arIssueTexts).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      if (!NO_WORDS.includes(key)) expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les paramètres {…} sont les mêmes en français et en arabe', () => {
    for (const key of keys) expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
  });

  it('les statuts, emplacements et refus de l’API sont traduits dans les deux langues', () => {
    const used = [
      ...Object.values(ISSUE_STATUS_LABEL_KEYS),
      ...Object.values(ISSUE_LOCATION_LABEL_KEYS),
      ...Object.values(ISSUE_ERRORS),
      ...Object.values(ISSUE_FORM_ERRORS),
    ];
    for (const key of used) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
    expect(ISSUE_STATUSES).toHaveLength(3);
    expect(ISSUE_LOCATIONS).toHaveLength(6);
  });

  it('les intitulés des acteurs de l’historique existent en français et en arabe', () => {
    for (const role of ['manager', 'treasurer', 'deputy', 'caretaker']) {
      expect(fr[`issues.actor.${role}` as keyof typeof fr]).toBeTruthy();
      expect(ar[`issues.actor.${role}` as keyof typeof ar]).toMatch(ARABIC_LETTER);
    }
    for (const key of Object.values(ROLE_LABEL_KEYS)) expect(ar[key], key).toMatch(ARABIC_LETTER);
  });

  it('textes de docs/signalements.png (écrans 1, 2, 3)', () => {
    expect(fr['issues.title']).toBe('Signalements');
    expect(fr['issues.new']).toBe('Signaler un problème');
    expect(fr['issues.urgent']).toBe('Urgent');
    expect(fr['issues.status.open']).toBe('Ouvert');
    expect(fr['issues.status.in_progress']).toBe('En cours');
    expect(fr['issues.status.resolved']).toBe('Résolu');
    expect(fr['issues.visibility']).toContain('Votre nom reste visible seulement par le syndic et le gardien.');
    expect(fr['issues.empty.title']).toBe('Aucun signalement pour l’instant');
    expect(fr['issues.field.title']).toBe('Quel est le problème ?');
    expect(fr['issues.field.location']).toBe('Où ?');
    expect(fr['issues.field.description']).toBe('Détails (facultatif)');
    expect(fr['issues.photo.add']).toBe('Ajouter une photo');
    expect(fr['issues.urgent.label']).toBe('C’est urgent');
    expect(fr['issues.urgent.description']).toBe('Danger, panne bloquante, fuite importante');
    expect(fr['issues.submit']).toBe('Envoyer le signalement');
    expect(fr['issues.toast.sent']).toBe('Signalement envoyé');
    expect(fr['issues.detail.follow']).toBe('Suivi');
    expect(fr['issues.comment.placeholder']).toBe('Ajouter un commentaire');
    expect(fr['issues.reopen.button']).toBe('Rouvrir ce signalement');
    for (const [code, label] of [['elevator', 'Ascenseur'], ['stairs', 'Escalier'], ['parking', 'Parking'], ['hall', 'Hall'], ['roof', 'Toiture'], ['other', 'Autre']]) {
      expect(fr[`issues.location.${code}` as keyof typeof fr]).toBe(label);
    }
  });

  it('textes de l’écran 6 en arabe (RTL)', () => {
    expect(ar['issues.title']).toBe('البلاغات');
    expect(ar['issues.new']).toBe('الإبلاغ عن مشكل');
    expect(translate('ar', 'issues.filter.active', { count: 3 })).toBe('3 · قيد المعالجة');
    expect(translate('ar', 'issues.filter.resolved', { count: 12 })).toBe('12 · تمت معالجتها');
    expect(ar['issues.status.in_progress']).toBe('قيد المعالجة');
  });

  it('une ligne de détail se compose sans nom d’habitant', () => {
    expect(translate('fr', 'issues.detail.reportedToday', { location: 'Ascenseur', time: '9 h 10' })).toBe(
      'Ascenseur · signalé aujourd’hui à 9 h 10',
    );
    expect(translate('fr', 'issues.event.by', { actor: translate('fr', 'issues.actor.you') })).toBe('Par vous');
  });
});
