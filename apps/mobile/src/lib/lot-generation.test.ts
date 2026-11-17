import { describe, expect, it } from 'vitest';

import { translate } from '../i18n/translate';
import {
  addBuilding,
  buildingChips,
  createButton,
  existingBuildings,
  generationSummary,
  initialBuildingState,
  normalizeBuildingName,
  planGeneration,
  previewCreated,
  removeAddedBuilding,
  toggleBuilding,
  type BuildingState,
} from './lot-generation';

/** A11 à A42 : bâtiment A, étages 1 à 4, 2 appartements par étage (ici 8 lots). */
const A_REFERENCES = ['A11', 'A12', 'A21', 'A22', 'A31', 'A32', 'A41', 'A42'];
const A_LOTS = A_REFERENCES.map((reference) => ({ reference, building: 'A' }));
const NONE: BuildingState = { added: [], selected: [] };

describe('puces des bâtiments', () => {
  it('les bâtiments existants viennent des appartements, sont triés et ne sont pas cochés au départ', () => {
    const existing = existingBuildings([...A_LOTS, { building: 'a' }, { building: null }, { building: 'B2' }]);
    expect(existing).toEqual(['A', 'B2']);
    const chips = buildingChips(existing, initialBuildingState(existing));
    expect(chips).toEqual([
      { name: 'A', existing: true, selected: false, removable: false },
      { name: 'B2', existing: true, selected: false, removable: false },
    ]);
  });

  it('une résidence encore vide propose le bâtiment A, coché', () => {
    expect(buildingChips([], initialBuildingState([]))).toEqual([
      { name: 'A', existing: false, selected: true, removable: true },
    ]);
  });

  it('« + Ajouter » crée une nouvelle puce et la sélectionne', () => {
    const result = addBuilding(['A'], NONE, 'b');
    expect(result.name).toBe('B');
    expect(buildingChips(['A'], result.state)).toEqual([
      { name: 'A', existing: true, selected: false, removable: false },
      { name: 'B', existing: false, selected: true, removable: true },
    ]);
  });

  it('le nom suit les règles : 4 caractères au maximum, majuscules, lettres et chiffres', () => {
    expect(normalizeBuildingName(' b2 ')).toBe('B2');
    expect(normalizeBuildingName('ABCD')).toBe('ABCD');
    expect(normalizeBuildingName('ABCDE')).toBeUndefined();
    expect(normalizeBuildingName('')).toBeUndefined();
    expect(normalizeBuildingName('A-1')).toBeUndefined();
    // Un nom invalide ne change rien.
    const state: BuildingState = { added: ['C'], selected: ['C'] };
    expect(addBuilding(['A'], state, 'ABCDE')).toEqual({ state, name: undefined });
  });

  it('un nom déjà utilisé sélectionne la puce existante au lieu d’en créer une autre', () => {
    // Bâtiment déjà créé.
    const onExisting = addBuilding(['A'], NONE, 'a');
    expect(onExisting.state).toEqual({ added: [], selected: ['A'] });
    expect(buildingChips(['A'], onExisting.state)).toHaveLength(1);
    // Nouvelle puce déjà ajoutée puis décochée.
    const added = addBuilding(['A'], NONE, 'B').state;
    const unchecked = toggleBuilding(added, 'B');
    const again = addBuilding(['A'], unchecked, 'b').state;
    expect(again.added).toEqual(['B']);
    expect(again.selected).toEqual(['B']);
  });

  it('on peut sélectionner un ou plusieurs bâtiments', () => {
    let state = addBuilding(['A'], NONE, 'B').state;
    state = toggleBuilding(state, 'A');
    expect(buildingChips(['A'], state).map((chip) => [chip.name, chip.selected])).toEqual([
      ['A', true],
      ['B', true],
    ]);
    state = toggleBuilding(state, 'B');
    expect(state.selected).toEqual(['A']);
  });

  it('une nouvelle puce non utilisée peut être retirée, pas un bâtiment déjà créé', () => {
    const state = addBuilding(['A'], NONE, 'B').state;
    const removed = removeAddedBuilding(['A'], state, 'B');
    expect(removed).toEqual({ added: [], selected: [] });
    expect(removeAddedBuilding(['A'], toggleBuilding(NONE, 'A'), 'A').selected).toEqual(['A']);
  });
});

describe('références à créer', () => {
  const draft = { floorFrom: '1', floorTo: '4', perFloor: 2 };

  it('utilise le nom de chaque bâtiment sélectionné : B11, B12… B42', () => {
    const plan = planGeneration({ ...draft, buildings: ['B'] }, A_REFERENCES);
    expect(plan.issue).toBeUndefined();
    if (plan.issue !== undefined) return;
    expect(plan.toCreate).toEqual(['B11', 'B12', 'B21', 'B22', 'B31', 'B32', 'B41', 'B42']);
    expect(plan.skipped).toBe(0);
    expect(plan.shape).toEqual({ buildings: ['B'], floorFrom: 1, floorTo: 4, perFloor: 2 });
  });

  it('plusieurs bâtiments : les références de chacun, dans l’ordre des puces', () => {
    const plan = planGeneration({ ...draft, floorTo: '1', buildings: ['B', 'C'] }, []);
    if (plan.issue !== undefined) throw new Error(plan.issue);
    expect(plan.toCreate).toEqual(['B11', 'B12', 'C11', 'C12']);
  });

  it('les appartements qui existent déjà sont ignorés au lieu de bloquer', () => {
    const plan = planGeneration({ ...draft, buildings: ['A', 'B'] }, A_REFERENCES);
    if (plan.issue !== undefined) throw new Error(plan.issue);
    expect(plan.references).toHaveLength(16);
    expect(plan.toCreate).toHaveLength(8);
    expect(plan.skipped).toBe(8);
    expect(plan.toCreate.every((reference) => reference.startsWith('B'))).toBe(true);
  });

  it('la même génération relancée : rien à créer', () => {
    const plan = planGeneration({ ...draft, buildings: ['A'] }, A_REFERENCES);
    if (plan.issue !== undefined) throw new Error(plan.issue);
    expect(plan.toCreate).toEqual([]);
    expect(plan.skipped).toBe(8);
    expect(createButton(plan.toCreate.length)).toMatchObject({ disabled: true, key: 'lots.createNothing' });
  });

  it('réglages invalides : aucun bâtiment, étages, trop d’appartements, références en double', () => {
    expect(planGeneration({ ...draft, buildings: [] }, [])).toEqual({ issue: 'lots.errors.noBuilding' });
    expect(planGeneration({ ...draft, floorFrom: '', buildings: ['A'] }, [])).toEqual({ issue: 'lots.errors.floors' });
    expect(planGeneration({ ...draft, floorFrom: '5', floorTo: '2', buildings: ['A'] }, [])).toEqual({
      issue: 'lots.errors.floors',
    });
    expect(planGeneration({ floorFrom: '0', floorTo: '100', perFloor: 20, buildings: ['A'] }, [])).toEqual({
      issue: 'lots.errors.tooMany',
    });
    // A1 + 10 et A11 + 0 donneraient la même référence : refusé comme par l'API.
    expect(planGeneration({ floorFrom: '1', floorTo: '11', perFloor: 10, buildings: ['A', 'A1'] }, []).issue).toBeDefined();
  });
});

describe('aperçu et compteurs', () => {
  it('montre toutes les références jusqu’à 8, sinon les premières puis « … et N autres »', () => {
    const refs = Array.from({ length: 24 }, (_, index) => `B${index}`);
    expect(previewCreated(refs.slice(0, 8))).toEqual({ shown: refs.slice(0, 8), more: 0 });
    expect(previewCreated(refs)).toEqual({ shown: refs.slice(0, 6), more: 18 });
    expect(translate('fr', 'lots.preview.more', { count: 18 })).toBe('… et 18 autres');
  });

  it('« N seront créés, M existent déjà » au singulier et au pluriel (français)', () => {
    const text = (created: number, skipped: number) => {
      const { key, params } = generationSummary(created, skipped);
      return translate('fr', key, params);
    };
    expect(text(4, 8)).toBe('4 seront créés, 8 existent déjà');
    expect(text(1, 8)).toBe('1 sera créé, 8 existent déjà');
    expect(text(4, 1)).toBe('4 seront créés, 1 existe déjà');
    expect(text(1, 1)).toBe('1 sera créé, 1 existe déjà');
    expect(text(8, 0)).toBe('8 appartements seront créés');
    expect(text(1, 0)).toBe('1 appartement sera créé');
    expect(text(0, 8)).toBe('Rien à créer : les 8 appartements existent déjà.');
    expect(text(0, 1)).toBe('Rien à créer : cet appartement existe déjà.');
  });

  it('les mêmes textes existent en arabe, avec les mêmes nombres', () => {
    for (const [created, skipped] of [[4, 8], [1, 8], [4, 1], [1, 1], [8, 0], [1, 0], [0, 8], [0, 1]] as const) {
      const { key, params } = generationSummary(created, skipped);
      const text = translate('ar', key, params);
      expect(text).toMatch(/[؀-ۿ]/);
      expect(text).not.toMatch(/\{/);
      if (created > 1) expect(text).toContain(String(created));
      if (skipped > 1) expect(text).toContain(String(skipped));
    }
  });

  it('le bouton indique le nombre réellement créé, et se désactive quand il n’y a rien à créer', () => {
    expect(createButton(8)).toEqual({ key: 'lots.createBulk', params: { created: 8 }, disabled: false });
    expect(translate('fr', 'lots.createBulk', { created: 8 })).toBe('Créer les 8 appartements');
    expect(createButton(1)).toMatchObject({ key: 'lots.createBulkOne', disabled: false });
    expect(createButton(0)).toMatchObject({ key: 'lots.createNothing', disabled: true });
    expect(translate('fr', 'lots.createNothing')).toBe('Rien à créer');
  });
});
