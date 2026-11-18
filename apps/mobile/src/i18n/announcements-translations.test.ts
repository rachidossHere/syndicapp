import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_LABEL_KEYS, ANNOUNCEMENT_ERRORS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ANNOUNCEMENT_FORM_ERRORS } from '../lib/announcements';
import { ar } from './ar';
import { arAnnouncementTexts } from './ar-announcements';
import { fr } from './fr';
import { frAnnouncementTexts } from './fr-announcements';
import { translate } from './translate';

const ARABIC_LETTER = /[؀-ۿ]/;
// Gabarits sans mot propre : « auteur · date ».
const NO_WORDS = ['announcements.meta'];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('traductions des annonces (plan 08, étape 3)', () => {
  const keys = Object.keys(frAnnouncementTexts) as (keyof typeof frAnnouncementTexts)[];

  it('chaque texte existe en français et en arabe, sans clé en trop', () => {
    expect(Object.keys(arAnnouncementTexts).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      if (!NO_WORDS.includes(key)) expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les paramètres {…} sont les mêmes en français et en arabe', () => {
    for (const key of keys) expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
  });

  it('catégories, refus de l’API et erreurs du formulaire sont traduits dans les deux langues', () => {
    const used = [
      ...Object.values(ANNOUNCEMENT_CATEGORY_LABEL_KEYS),
      ...Object.values(ANNOUNCEMENT_ERRORS),
      ...Object.values(ANNOUNCEMENT_FORM_ERRORS),
    ];
    for (const key of used) {
      expect(fr[key as keyof typeof fr], `fr : ${key}`).toBeTruthy();
      expect(ar[key as keyof typeof ar], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
    expect(ANNOUNCEMENT_CATEGORIES).toHaveLength(4);
  });

  it('textes de docs/annonces.png en français (écrans 3, 4 et 5)', () => {
    expect(fr['announcements.title']).toBe('Annonces');
    expect(fr['announcements.pinned']).toBe('Épinglée');
    expect(fr['announcements.category.works']).toBe('Travaux');
    expect(fr['announcements.category.meeting']).toBe('Assemblée');
    expect(fr['announcements.category.info']).toBe('Info');
    expect(fr['announcements.category.urgent']).toBe('Urgent');
    expect(fr['announcements.form.title']).toBe('Nouvelle annonce');
    expect(fr['announcements.field.category']).toBe('Catégorie');
    expect(fr['announcements.field.title']).toBe('Titre');
    expect(fr['announcements.field.body']).toBe('Message');
    expect(fr['announcements.pinToggle.label']).toBe('Épingler en haut');
    expect(fr['announcements.submit']).toBe('Publier l’annonce');
    expect(fr['announcements.latest.title']).toBe('Dernière annonce');
    expect(fr['announcements.latest.seeAll']).toBe('Voir toutes les annonces');
    expect(fr['announcements.author.manager']).toBe('Le syndic');
    expect(fr['announcements.author.deputy']).toBe('L’adjoint');
  });

  it('textes de l’écran 7 en arabe (RTL)', () => {
    expect(ar['announcements.title']).toBe('الإعلانات');
    expect(ar['announcements.category.works']).toBe('أشغال');
    expect(ar['announcements.category.urgent']).toBe('عاجل');
    expect(ar['announcements.pinned']).toBe('مثبّت');
  });

  it('« Les N membres de la résidence seront prévenus » : singulier et pluriel, en français et en arabe', () => {
    expect(translate('fr', 'announcements.audience.other', { count: 24 })).toBe('Les 24 membres de la résidence seront prévenus');
    expect(translate('fr', 'announcements.audience.one')).toBe('1 membre de la résidence sera prévenu');
    expect(translate('fr', 'announcements.audience.none')).toContain('Aucun');
    expect(translate('ar', 'announcements.audience.other', { count: 24 })).toContain('24');
    expect(translate('ar', 'announcements.audience.other', { count: 24 })).toMatch(ARABIC_LETTER);
    expect(translate('ar', 'announcements.audience.one')).toMatch(ARABIC_LETTER);
  });

  it('une ligne « auteur · date » se compose par le rôle, sans nom', () => {
    const when = translate('fr', 'announcements.when.today', { time: '8 h 30' });
    expect(when).toBe('aujourd’hui à 8 h 30');
    expect(translate('fr', 'announcements.meta', { author: translate('fr', 'announcements.author.manager'), when })).toBe(
      'Le syndic · aujourd’hui à 8 h 30',
    );
  });

  it('le texte de la notification de test est celui de l’API (générique, sans titre)', () => {
    expect(fr['announcements.simulate.body']).toBe('Nouvelle annonce dans votre résidence');
    expect(ar['announcements.simulate.body']).toBe('إعلان جديد في إقامتك');
  });
});
