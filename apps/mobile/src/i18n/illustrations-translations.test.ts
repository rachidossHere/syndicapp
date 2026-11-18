import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { fr } from './fr';

const ARABIC_LETTER = /[؀-ۿ]/;
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

// Textes ajoutés ou changés à l'étape 2 du plan 02b.
const KEYS = [
  'welcome.logoText',
  'welcome.title',
  'welcome.subtitle',
  'issues.empty.title',
  'issues.empty.body',
  'announcements.pinnedMeta',
  'announcements.filter.all',
  'announcements.filterEmpty.title',
  'announcements.filterEmpty.body',
] as const;

describe('traductions de l’étape 2 du plan 02b', () => {
  it('chaque texte existe en français et en arabe', () => {
    for (const key of KEYS) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      // Le logo texte reste « SYNDICAPP » dans les deux langues.
      if (key !== 'welcome.logoText') expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
    expect(ar['welcome.logoText']).toBe('SYNDICAPP');
  });

  it('les paramètres {…} sont les mêmes en français et en arabe', () => {
    for (const key of KEYS) expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
  });

  it('les anciens textes de l’écran de bienvenue ont disparu des deux langues', () => {
    for (const key of ['welcome.tagline', 'welcome.benefitCharges', 'welcome.benefitExpenses', 'welcome.benefitReports']) {
      expect(fr).not.toHaveProperty(key);
      expect(ar).not.toHaveProperty(key);
    }
  });
});
