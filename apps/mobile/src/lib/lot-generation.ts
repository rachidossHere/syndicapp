// Génération rapide des appartements : puces des bâtiments, références à créer et textes de l'aperçu.
// Logique pure (sans React) pour pouvoir la tester ; l'écran ne fait que l'afficher.
import { bulkLotsSchema, generateBulkLots, MAX_BULK_LOTS, type BulkLotsShape } from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

/** Nom de bâtiment : 4 caractères au maximum, lettres et chiffres, en majuscules. */
const BUILDING_PATTERN = /^[A-Z0-9]{1,4}$/;
const FLOOR_PATTERN = /^\d{1,3}$/;
/** Nom proposé quand la résidence n'a encore aucun appartement. */
const DEFAULT_BUILDING = 'A';
/** Au-delà de ce nombre de références, l'aperçu en montre les premières puis « … et N autres ». */
const PREVIEW_ALL_UP_TO = 8;
const PREVIEW_SHOWN = 6;

/** Nom normalisé (majuscules, sans espaces autour), ou `undefined` s'il n'est pas valide. */
export function normalizeBuildingName(input: string): string | undefined {
  const name = input.trim().toUpperCase();
  return BUILDING_PATTERN.test(name) ? name : undefined;
}

/** Bâtiments déjà présents, déduits des appartements existants (sans doublon, triés). */
export function existingBuildings(lots: readonly { building: string | null }[]): string[] {
  const names = new Set<string>();
  for (const lot of lots) {
    const name = lot.building === null ? undefined : normalizeBuildingName(lot.building);
    if (name !== undefined) names.add(name);
  }
  return [...names].sort(new Intl.Collator('fr', { numeric: true }).compare);
}

/** Choix de l'utilisateur : nouveaux bâtiments ajoutés (pas encore créés) et bâtiments cochés. */
export type BuildingState = { added: readonly string[]; selected: readonly string[] };

/**
 * État de départ : les bâtiments existants ne sont pas cochés ; une résidence encore vide propose
 * le bâtiment « A », coché.
 */
export function initialBuildingState(existing: readonly string[]): BuildingState {
  return existing.length === 0
    ? { added: [DEFAULT_BUILDING], selected: [DEFAULT_BUILDING] }
    : { added: [], selected: [] };
}

export type BuildingChip = {
  name: string;
  /** Déjà créé : la puce porte la mention « déjà créé ». */
  existing: boolean;
  selected: boolean;
  /** Nouvelle puce qu'on peut encore retirer. */
  removable: boolean;
};

/** Puces affichées : d'abord les bâtiments existants, puis les nouveaux dans l'ordre d'ajout. */
export function buildingChips(existing: readonly string[], state: BuildingState): BuildingChip[] {
  const known = new Set(existing);
  const fresh = state.added.filter((name) => !known.has(name));
  return [
    ...existing.map((name) => ({ name, existing: true, selected: state.selected.includes(name), removable: false })),
    ...fresh.map((name) => ({ name, existing: false, selected: state.selected.includes(name), removable: true })),
  ];
}

const withSelected = (selected: readonly string[], name: string): string[] =>
  selected.includes(name) ? [...selected] : [...selected, name];

/**
 * « + Ajouter » validé : une nouvelle puce est créée et cochée. Un nom déjà présent (existant ou
 * ajouté) coche la puce existante au lieu d'en créer une autre. Un nom invalide ne change rien.
 */
export function addBuilding(
  existing: readonly string[],
  state: BuildingState,
  input: string,
): { state: BuildingState; name: string | undefined } {
  const name = normalizeBuildingName(input);
  if (name === undefined) return { state, name: undefined };
  const known = existing.includes(name) || state.added.includes(name);
  return {
    name,
    state: { added: known ? state.added : [...state.added, name], selected: withSelected(state.selected, name) },
  };
}

export function toggleBuilding(state: BuildingState, name: string): BuildingState {
  return {
    added: state.added,
    selected: state.selected.includes(name)
      ? state.selected.filter((item) => item !== name)
      : [...state.selected, name],
  };
}

/** Retire une nouvelle puce non utilisée. Un bâtiment déjà créé ne se retire pas. */
export function removeAddedBuilding(
  existing: readonly string[],
  state: BuildingState,
  name: string,
): BuildingState {
  if (existing.includes(name) || !state.added.includes(name)) return state;
  return {
    added: state.added.filter((item) => item !== name),
    selected: state.selected.filter((item) => item !== name),
  };
}

export type BulkIssue =
  | 'lots.errors.noBuilding'
  | 'lots.errors.floors'
  | 'lots.errors.tooMany'
  | 'lots.errors.invalid';

export type GenerationDraft = {
  /** Bâtiments cochés, dans l'ordre d'affichage des puces. */
  buildings: readonly string[];
  floorFrom: string;
  floorTo: string;
  perFloor: number;
};

export type GenerationPlan =
  | { issue: BulkIssue }
  | {
      issue?: undefined;
      /** Réglages à envoyer à l'API. */
      shape: BulkLotsShape;
      /** Toutes les références demandées, existantes ou non. */
      references: string[];
      /** Références qui n'existent pas encore : celles que l'API va créer. */
      toCreate: string[];
      /** Nombre de références demandées qui existent déjà : ignorées par l'API. */
      skipped: number;
    };

/** Références demandées, séparées entre celles à créer et celles qui existent déjà. */
export function planGeneration(draft: GenerationDraft, existingReferences: Iterable<string>): GenerationPlan {
  if (draft.buildings.length === 0) return { issue: 'lots.errors.noBuilding' };
  if (!FLOOR_PATTERN.test(draft.floorFrom) || !FLOOR_PATTERN.test(draft.floorTo)) {
    return { issue: 'lots.errors.floors' };
  }
  const floorFrom = Number(draft.floorFrom);
  const floorTo = Number(draft.floorTo);
  if (floorFrom > floorTo) return { issue: 'lots.errors.floors' };
  if (draft.buildings.length * (floorTo - floorFrom + 1) * draft.perFloor > MAX_BULK_LOTS) {
    return { issue: 'lots.errors.tooMany' };
  }
  const shape: BulkLotsShape = { buildings: [...draft.buildings], floorFrom, floorTo, perFloor: draft.perFloor };
  if (!bulkLotsSchema.safeParse(shape).success) return { issue: 'lots.errors.invalid' };

  const known = new Set(existingReferences);
  const references = generateBulkLots(shape).map((lot) => lot.reference);
  const toCreate = references.filter((reference) => !known.has(reference));
  return { shape, references, toCreate, skipped: references.length - toCreate.length };
}

/** Références montrées dans l'aperçu : toutes jusqu'à 8, sinon les 6 premières puis le nombre d'autres. */
export function previewCreated(references: readonly string[]): { shown: string[]; more: number } {
  if (references.length <= PREVIEW_ALL_UP_TO) return { shown: [...references], more: 0 };
  return { shown: references.slice(0, PREVIEW_SHOWN), more: references.length - PREVIEW_SHOWN };
}

/**
 * Phrase de l'aperçu : « 4 seront créés, 8 existent déjà » (singulier et pluriel pour chaque
 * nombre), « Rien à créer… » quand tout existe déjà.
 */
export function generationSummary(
  created: number,
  skipped: number,
): { key: TranslationKey; params: { created: number; skipped: number } } {
  const params = { created, skipped };
  if (skipped === 0) return { key: created === 1 ? 'lots.preview.countOne' : 'lots.preview.count', params };
  if (created === 0) return { key: skipped === 1 ? 'lots.preview.nothingOne' : 'lots.preview.nothing', params };
  if (created === 1) return { key: skipped === 1 ? 'lots.preview.skipOneOne' : 'lots.preview.skipOneMany', params };
  return { key: skipped === 1 ? 'lots.preview.skipManyOne' : 'lots.preview.skipManyMany', params };
}

/** Texte du bouton : le nombre réellement créé, ou « Rien à créer » (bouton alors désactivé). */
export function createButton(created: number): { key: TranslationKey; params: { created: number }; disabled: boolean } {
  if (created === 0) return { key: 'lots.createNothing', params: { created }, disabled: true };
  return { key: created === 1 ? 'lots.createBulkOne' : 'lots.createBulk', params: { created }, disabled: false };
}

/** Un nom de bâtiment de la saisie est-il acceptable ? (pour l'aide sous le champ) */
export const isBuildingName = (input: string): boolean => normalizeBuildingName(input) !== undefined;
