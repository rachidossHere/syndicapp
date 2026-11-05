import { describe, expect, it } from 'vitest';

import { formatAmount } from './amount-format';

/** Rend le test lisible : espaces insécables → espaces, isolation bidirectionnelle retirée. */
const visible = (value: string) => value.replace(/ /g, ' ').replace(/[⁦⁩]/g, '');

describe('formatAmount', () => {
  it.each([
    [0, '0 MAD'],
    [45000, '450 MAD'],
    [1842000, '18 420 MAD'],
    [125000000, '1 250 000 MAD'],
  ])('neutre : %i centimes → « %s »', (centimes, expected) => {
    expect(visible(formatAmount(centimes))).toBe(expected);
  });

  it.each([
    [0, '+ 0 MAD'],
    [45000, '+ 450 MAD'],
    [1842000, '+ 18 420 MAD'],
    [125000000, '+ 1 250 000 MAD'],
  ])('entrée : %i centimes → « %s »', (centimes, expected) => {
    expect(visible(formatAmount(centimes, 'in'))).toBe(expected);
  });

  it.each([
    [45000, '− 450 MAD'],
    [240000, '− 2 400 MAD'],
    [-240000, '− 2 400 MAD'],
    [125000000, '− 1 250 000 MAD'],
  ])('sortie : %i centimes → « %s »', (centimes, expected) => {
    expect(visible(formatAmount(centimes, 'out'))).toBe(expected);
  });

  it('isole le montant de gauche à droite pour l’arabe et n’utilise que des espaces insécables', () => {
    const result = formatAmount(1842000, 'in');
    expect(result.startsWith('⁦')).toBe(true);
    expect(result.endsWith('⁩')).toBe(true);
    expect(result).not.toMatch(/ /);
  });
});
