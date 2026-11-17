import type { LotStatus } from '@syndic/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { translate } from '../i18n/translate';
import {
  buildingCount,
  clearExpansion,
  getExpansion,
  groupLots,
  isSectionOpen,
  listSummaryParts,
  matchesLot,
  NO_BUILDING_KEY,
  sectionSummaryParts,
  sectionViews,
  setExpansion,
  type CountPart,
} from './lot-groups';

type TestLot = { reference: string; building: string | null; status: LotStatus };

/** Bâtiment A : A11 à A13 (A11 membre, A12 en attente) ; bâtiment B : B21 à B23 ; deux sans bâtiment. */
const LOTS: TestLot[] = [
  { reference: 'A11', building: 'A', status: 'member' },
  { reference: 'A12', building: 'A', status: 'pending' },
  { reference: 'A13', building: 'A', status: 'free' },
  { reference: 'B21', building: 'B', status: 'free' },
  { reference: 'B22', building: 'B', status: 'free' },
  { reference: 'B23', building: 'B', status: 'free' },
  { reference: 'X1', building: null, status: 'free' },
  { reference: 'X2', building: '  ', status: 'member' },
];

const text = (parts: readonly CountPart[], language: 'fr' | 'ar' = 'fr') =>
  parts.map((part) => translate(language, part.key, part.params)).join(' · ');

describe('regroupement par bâtiment', () => {
  it('une section par bâtiment, triée par nom, « Sans bâtiment » en dernier', () => {
    const shuffled = [LOTS[6]!, LOTS[3]!, LOTS[0]!, LOTS[7]!, LOTS[4]!, LOTS[1]!, LOTS[5]!, LOTS[2]!];
    const sections = groupLots(shuffled);
    expect(sections.map((section) => section.key)).toEqual(['A', 'B', NO_BUILDING_KEY]);
    expect(sections.map((section) => section.building)).toEqual(['A', 'B', null]);
  });

  it('ordre naturel des noms : B2 avant B10, et les noms sont mis en majuscules', () => {
    const lots: TestLot[] = ['B10', 'b2', 'A', 'B1'].map((building) => ({ reference: `${building}1`, building, status: 'free' }));
    expect(groupLots(lots).map((section) => section.key)).toEqual(['A', 'B1', 'B2', 'B10']);
  });

  it('les appartements sans bâtiment (null ou vide) vont dans « Sans bâtiment »', () => {
    const none = groupLots(LOTS).at(-1)!;
    expect(none.building).toBeNull();
    expect(none.lots.map((lot) => lot.reference)).toEqual(['X1', 'X2']);
  });

  it('compte les appartements et les statuts de chaque section', () => {
    const [a, b, none] = groupLots(LOTS);
    expect(a!.stats).toEqual({ total: 3, member: 1, pending: 1, free: 1 });
    expect(b!.stats).toEqual({ total: 3, member: 0, pending: 0, free: 3 });
    expect(none!.stats).toEqual({ total: 2, member: 1, pending: 0, free: 1 });
  });

  it('un bâtiment est un bâtiment : « Sans bâtiment » n’est pas compté', () => {
    expect(buildingCount(groupLots(LOTS))).toBe(2);
    expect(buildingCount(groupLots(LOTS.slice(0, 3)))).toBe(1);
    expect(buildingCount(groupLots([LOTS[6]!]))).toBe(0);
  });

  it('une résidence sans aucun appartement n’a aucune section', () => {
    expect(groupLots([])).toEqual([]);
  });
});

describe('filtres et recherche dans chaque section', () => {
  it('le filtre s’applique dans chaque section', () => {
    const free = sectionViews(groupLots(LOTS), 'free', '');
    expect(free.map((view) => view.visible.map((lot) => lot.reference))).toEqual([['A13'], ['B21', 'B22', 'B23'], ['X1']]);
    const members = sectionViews(groupLots(LOTS), 'member', '');
    expect(members.map((view) => view.visible.length)).toEqual([1, 0, 1]);
  });

  it('la recherche « B2 » ne garde que les références qui la contiennent, en majuscules ou non', () => {
    expect(matchesLot(LOTS[3]!, 'all', 'B2')).toBe(true);
    expect(matchesLot(LOTS[3]!, 'all', ' b2 ')).toBe(true);
    expect(matchesLot(LOTS[0]!, 'all', 'B2')).toBe(false);
    const views = sectionViews(groupLots(LOTS), 'all', 'B2');
    expect(views.map((view) => view.visible.length)).toEqual([0, 3, 0]);
  });

  it('le filtre et la recherche se combinent', () => {
    expect(sectionViews(groupLots(LOTS), 'member', 'A1').map((view) => view.visible.map((l) => l.reference))).toEqual([
      ['A11'],
      [],
      [],
    ]);
  });
});

describe('ouverture des sections', () => {
  const base = { key: 'A', sectionCount: 2, visible: 3, searching: false, stored: {}, searchToggles: {} };

  it('plusieurs bâtiments : tous fermés au départ ; un seul bâtiment : ouvert', () => {
    expect(isSectionOpen(base)).toBe(false);
    expect(isSectionOpen({ ...base, sectionCount: 3, key: NO_BUILDING_KEY })).toBe(false);
    expect(isSectionOpen({ ...base, sectionCount: 1 })).toBe(true);
  });

  it('l’état choisi l’emporte sur le défaut, dans les deux sens', () => {
    expect(isSectionOpen({ ...base, stored: { A: true } })).toBe(true);
    expect(isSectionOpen({ ...base, sectionCount: 1, stored: { A: false } })).toBe(false);
  });

  it('une section sans résultat reste fermée, même choisie ouverte', () => {
    expect(isSectionOpen({ ...base, visible: 0, stored: { A: true } })).toBe(false);
    expect(isSectionOpen({ ...base, visible: 0, searching: true })).toBe(false);
  });

  it('pendant une recherche : seules les sections avec un résultat s’ouvrent', () => {
    // Recherche « B2 » : A sans résultat (fermée), B avec 3 résultats (ouverte), même si l’état gardé dit l’inverse.
    const search = { searching: true, stored: { A: true, B: false } };
    expect(isSectionOpen({ ...base, ...search, key: 'A', visible: 0 })).toBe(false);
    expect(isSectionOpen({ ...base, ...search, key: 'B', visible: 3 })).toBe(true);
  });

  it('pendant une recherche, l’utilisateur peut refermer une section ; l’état d’avant revient ensuite', () => {
    const stored = { A: true };
    expect(isSectionOpen({ ...base, searching: true, visible: 3, stored, searchToggles: { A: false } })).toBe(false);
    // Recherche effacée : les choix faits pendant la recherche ne comptent plus, on retrouve l’état gardé.
    expect(isSectionOpen({ ...base, searching: false, visible: 3, stored, searchToggles: { A: false } })).toBe(true);
  });

  beforeEach(() => clearExpansion());

  it('l’état est gardé en mémoire par résidence, sans stockage', () => {
    expect(getExpansion('residence-1')).toEqual({});
    setExpansion('residence-1', { A: true });
    setExpansion('residence-2', { B: true });
    expect(getExpansion('residence-1')).toEqual({ A: true });
    expect(getExpansion('residence-2')).toEqual({ B: true });
    clearExpansion();
    expect(getExpansion('residence-1')).toEqual({});
  });
});

describe('résumés', () => {
  it('sous le titre : « N bâtiments · M appartements », au singulier et au pluriel', () => {
    expect(text(listSummaryParts(2, 30))).toBe('2 bâtiments · 30 appartements');
    expect(text(listSummaryParts(1, 1))).toBe('1 bâtiment · 1 appartement');
    expect(text(listSummaryParts(1, 12))).toBe('1 bâtiment · 12 appartements');
    expect(text(listSummaryParts(0, 5))).toBe('5 appartements');
  });

  it('section sans filtre : « 15 appartements · 1 membre », « aucun membre »', () => {
    const stats = (total: number, member: number) => ({ total, member, pending: 0, free: total - member });
    expect(text(sectionSummaryParts(stats(15, 1), 'all', false, 15))).toBe('15 appartements · 1 membre');
    expect(text(sectionSummaryParts(stats(15, 0), 'all', false, 15))).toBe('15 appartements · aucun membre');
    expect(text(sectionSummaryParts(stats(1, 1), 'all', false, 1))).toBe('1 appartement · 1 membre');
    expect(text(sectionSummaryParts(stats(15, 3), 'all', false, 15))).toBe('15 appartements · 3 membres');
  });

  it('selon le filtre actif : membres, en attente, libres', () => {
    const stats = { total: 15, member: 3, pending: 1, free: 11 };
    expect(text(sectionSummaryParts(stats, 'member', false, 3))).toBe('3 membres');
    expect(text(sectionSummaryParts(stats, 'pending', false, 1))).toBe('1 en attente');
    expect(text(sectionSummaryParts(stats, 'free', false, 11))).toBe('11 libres');
    expect(text(sectionSummaryParts({ ...stats, free: 1 }, 'free', false, 1))).toBe('1 libre');
  });

  it('pendant une recherche : « 3 résultats », « 1 résultat », « aucun résultat »', () => {
    const stats = { total: 15, member: 3, pending: 1, free: 11 };
    expect(text(sectionSummaryParts(stats, 'all', true, 3))).toBe('3 résultats');
    expect(text(sectionSummaryParts(stats, 'all', true, 1))).toBe('1 résultat');
    expect(text(sectionSummaryParts(stats, 'all', true, 0))).toBe('aucun résultat');
    // Filtre qui ne garde rien dans la section, sans recherche.
    expect(text(sectionSummaryParts({ ...stats, member: 0 }, 'member', false, 0))).toBe('aucun résultat');
  });

  it('les mêmes résumés existent en arabe, avec les mêmes nombres', () => {
    const stats = { total: 15, member: 3, pending: 1, free: 11 };
    const all: CountPart[][] = [
      listSummaryParts(2, 30),
      listSummaryParts(1, 1),
      sectionSummaryParts(stats, 'all', false, 15),
      sectionSummaryParts({ ...stats, member: 0 }, 'all', false, 15),
      sectionSummaryParts(stats, 'member', false, 3),
      sectionSummaryParts(stats, 'pending', false, 1),
      sectionSummaryParts(stats, 'free', false, 11),
      sectionSummaryParts(stats, 'all', true, 3),
      sectionSummaryParts(stats, 'all', true, 0),
    ];
    for (const parts of all) {
      const ar = text(parts, 'ar');
      expect(ar).toMatch(/[؀-ۿ]/);
      expect(ar).not.toContain('{');
      for (const part of parts) if (part.params) expect(ar).toContain(String(part.params.count));
    }
  });

  it('titres des sections', () => {
    expect(translate('fr', 'lots.building.title', { name: 'A' })).toBe('Bâtiment A');
    expect(translate('fr', 'lots.building.none')).toBe('Sans bâtiment');
    expect(translate('ar', 'lots.building.title', { name: 'A' })).toContain('A');
    expect(translate('ar', 'lots.building.none')).toMatch(/[؀-ۿ]/);
  });
});
