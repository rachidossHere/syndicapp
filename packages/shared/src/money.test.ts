import { describe, expect, it } from 'vitest';

import { formatMad } from './money';

/** Remplace les espaces lisibles du test par des espaces insécables (U+00A0). */
const nb = (value: string) => value.replace(/ /g, ' ');

describe('formatMad', () => {
  it.each([
    [0, '0 MAD'],
    [45000, '450 MAD'],
    [1842000, '18 420 MAD'],
    [125000000, '1 250 000 MAD'],
    [45050, '450,50 MAD'],
    [45005, '450,05 MAD'],
    [99, '0,99 MAD'],
    [-240000, '− 2 400 MAD'],
  ])('formate %i centimes en « %s »', (centimes, expected) => {
    expect(formatMad(centimes)).toBe(nb(expected));
  });

  it('utilise uniquement des espaces insécables', () => {
    const result = formatMad(1842000);
    expect(result).toBe('18 420 MAD');
    expect(result).not.toMatch(/ /);
  });

  it('affiche 0 sans signe pour -0', () => {
    expect(formatMad(-0)).toBe(nb('0 MAD'));
  });

  it.each([450.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuse %s',
    (value) => {
      expect(() => formatMad(value)).toThrow(TypeError);
      expect(() => formatMad(value)).toThrow(/entier de centimes/);
    },
  );
});
