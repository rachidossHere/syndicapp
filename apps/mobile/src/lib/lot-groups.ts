// Liste « Appartements » groupée par bâtiment : sections, filtres, recherche, résumés et état
// ouvert ou fermé. Logique pure (sans React) pour pouvoir la tester ; l'écran ne fait que l'afficher.
import type { LotStatus } from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

export type LotFilter = 'all' | LotStatus;

/** Ce que la liste a besoin de savoir d'un appartement. */
export type GroupableLot = { reference: string; building: string | null; status: LotStatus };

/** Clé de la section « Sans bâtiment » (jamais un nom de bâtiment : 4 caractères alphanumériques au plus). */
export const NO_BUILDING_KEY = '-';

const naturalOrder = new Intl.Collator('fr', { numeric: true });

export type LotStats = { total: number; member: number; pending: number; free: number };

export type LotSection<L extends GroupableLot> = {
  /** Nom du bâtiment, ou `NO_BUILDING_KEY` pour les appartements sans bâtiment. */
  key: string;
  building: string | null;
  /** Tous les appartements du bâtiment, dans l'ordre reçu (déjà triés par référence). */
  lots: L[];
  stats: LotStats;
};

const emptyStats = (): LotStats => ({ total: 0, member: 0, pending: 0, free: 0 });

/** Sections triées par nom de bâtiment (ordre naturel : B2 avant B10), « Sans bâtiment » en dernier. */
export function groupLots<L extends GroupableLot>(lots: readonly L[]): LotSection<L>[] {
  const sections = new Map<string, LotSection<L>>();
  for (const lot of lots) {
    const building = lot.building === null || lot.building.trim() === '' ? null : lot.building.trim().toUpperCase();
    const key = building ?? NO_BUILDING_KEY;
    let section = sections.get(key);
    if (!section) {
      section = { key, building, lots: [], stats: emptyStats() };
      sections.set(key, section);
    }
    section.lots.push(lot);
    section.stats.total += 1;
    section.stats[lot.status] += 1;
  }
  return [...sections.values()].sort((a, b) => {
    if (a.building === null) return 1;
    if (b.building === null) return -1;
    return naturalOrder.compare(a.building, b.building);
  });
}

/** Nombre de bâtiments (la section « Sans bâtiment » n'en est pas un). */
export const buildingCount = (sections: readonly { building: string | null }[]): number =>
  sections.filter((section) => section.building !== null).length;

/** Recherche sur la référence (saisie en majuscules) et filtre de statut. */
export function matchesLot(lot: GroupableLot, filter: LotFilter, needle: string): boolean {
  if (filter !== 'all' && lot.status !== filter) return false;
  const search = needle.trim().toUpperCase();
  return search === '' || lot.reference.toUpperCase().includes(search);
}

export type CountPart = { key: TranslationKey; params?: { count: number } };

const plural = (count: number, one: TranslationKey, many: TranslationKey): CountPart =>
  count === 1 ? { key: one } : { key: many, params: { count } };

/** « 2 bâtiments · 30 appartements » (sous le titre) : les parties à joindre avec « · ». */
export function listSummaryParts(buildings: number, lots: number): CountPart[] {
  const lotsPart = plural(lots, 'lots.count.lotsOne', 'lots.count.lots');
  if (buildings === 0) return [lotsPart];
  return [plural(buildings, 'lots.count.buildingsOne', 'lots.count.buildings'), lotsPart];
}

/**
 * Sous-titre d'une section selon le filtre actif, ou le nombre de résultats pendant une recherche.
 * Sans résultat : « aucun résultat ».
 */
export function sectionSummaryParts(
  stats: LotStats,
  filter: LotFilter,
  searching: boolean,
  matched: number,
): CountPart[] {
  if (matched === 0) return [{ key: 'lots.count.noResult' }];
  if (searching) return [plural(matched, 'lots.count.resultsOne', 'lots.count.results')];
  switch (filter) {
    case 'member':
      return [plural(matched, 'lots.count.membersOne', 'lots.count.members')];
    case 'pending':
      return [plural(matched, 'lots.count.pendingOne', 'lots.count.pending')];
    case 'free':
      return [plural(matched, 'lots.count.freeOne', 'lots.count.free')];
    case 'all':
      return [
        plural(stats.total, 'lots.count.lotsOne', 'lots.count.lots'),
        stats.member === 0
          ? { key: 'lots.count.noMember' }
          : plural(stats.member, 'lots.count.membersOne', 'lots.count.members'),
      ];
  }
}

export type SectionView<L extends GroupableLot> = LotSection<L> & {
  /** Appartements qui passent le filtre et la recherche. */
  visible: L[];
};

/** Sections avec leurs appartements visibles (filtre et recherche appliqués dans chaque section). */
export function sectionViews<L extends GroupableLot>(
  sections: readonly LotSection<L>[],
  filter: LotFilter,
  search: string,
): SectionView<L>[] {
  return sections.map((section) => ({
    ...section,
    visible: section.lots.filter((lot) => matchesLot(lot, filter, search)),
  }));
}

/** Ouvertures choisies par l'utilisateur, par clé de section. */
export type Expansion = Readonly<Record<string, boolean>>;

/**
 * Une section est-elle ouverte ?
 * - sans résultat (filtre ou recherche) : fermée, il n'y a rien à montrer ;
 * - pendant une recherche : ouverte, sauf si l'utilisateur l'a refermée pendant cette recherche ;
 * - sinon : l'état choisi, ou par défaut ouverte s'il n'y a qu'un seul bâtiment, fermée sinon.
 */
export function isSectionOpen(input: {
  key: string;
  sectionCount: number;
  visible: number;
  searching: boolean;
  stored: Expansion;
  searchToggles: Expansion;
}): boolean {
  if (input.visible === 0) return false;
  if (input.searching) return input.searchToggles[input.key] ?? true;
  return input.stored[input.key] ?? input.sectionCount === 1;
}

/**
 * États ouvert ou fermé gardés en mémoire (pas de stockage) par résidence : on les retrouve en
 * revenant sur l'écran, par exemple après la fiche d'un appartement.
 */
const memory = new Map<string, Expansion>();

export const getExpansion = (residenceId: string): Expansion => memory.get(residenceId) ?? {};
export const setExpansion = (residenceId: string, expansion: Expansion): void => {
  memory.set(residenceId, expansion);
};
/** Efface la mémoire (déconnexion, tests). */
export const clearExpansion = (): void => memory.clear();
