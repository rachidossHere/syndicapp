import { describe, expect, it } from 'vitest';

import { bulkLotsSchema, createLotSchema, generateBulkLots } from './residences';

describe('génération rapide des lots', () => {
  it('référence = bâtiment + étage + numéro', () => {
    const input = bulkLotsSchema.parse({
      buildings: ['a', 'B'],
      floorFrom: 1,
      floorTo: 4,
      perFloor: 3,
    });
    const refs = generateBulkLots(input).map((lot) => lot.reference);
    expect(refs).toHaveLength(24);
    expect(refs[0]).toBe('A11');
    expect(refs).toContain('B43');
  });

  it('accepte exactement 500 lots, refuse 501 et plus', () => {
    const base = { floorFrom: 1, floorTo: 100, perFloor: 1 };
    expect(
      bulkLotsSchema.safeParse({ ...base, buildings: ['A', 'B', 'C', 'D', 'E'] }).success,
    ).toBe(true);
    expect(
      bulkLotsSchema.safeParse({ ...base, buildings: ['A', 'B', 'C', 'D', 'E', 'F'] }).success,
    ).toBe(false);
    expect(
      bulkLotsSchema.safeParse({ buildings: ['A'], floorFrom: 0, floorTo: 100, perFloor: 5 })
        .success,
    ).toBe(false);
  });

  it('refuse étages inversés, bâtiments en double ou références ambiguës', () => {
    expect(
      bulkLotsSchema.safeParse({ buildings: ['A'], floorFrom: 3, floorTo: 1, perFloor: 1 }).success,
    ).toBe(false);
    expect(
      bulkLotsSchema.safeParse({ buildings: ['A', 'a'], floorFrom: 1, floorTo: 1, perFloor: 1 })
        .success,
    ).toBe(false);
    // A1 + 10 = A110 = A11 + 0 (étage 11, numéro 0 n'existe pas) mais A1+11 = A111 = A11+1.
    expect(
      bulkLotsSchema.safeParse({ buildings: ['A'], floorFrom: 1, floorTo: 11, perFloor: 11 })
        .success,
    ).toBe(false);
  });
});

describe('createLotSchema', () => {
  it('type apartment par défaut, champs vides ignorés', () => {
    expect(createLotSchema.parse({ reference: ' B12 ', building: '' })).toEqual({
      reference: 'B12',
      building: undefined,
      type: 'apartment',
    });
  });
});
