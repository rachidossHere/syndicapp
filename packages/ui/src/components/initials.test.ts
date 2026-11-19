import { describe, expect, it } from 'vitest';

import { getInitial, getInitials } from './initials';

describe('getInitials', () => {
  it.each([
    ['Rachid Tazi', 'RT'],
    ['Yassine', 'Y'],
    ['Y. Alaoui', 'YA'],
    ['rachid tazi', 'RT'],
    ['Mohamed Amine El Idrissi', 'MI'],
    ['Jean-Pierre Martin', 'JM'],
    ['رشيد تازي', 'رت'],
  ])('« %s » → « %s »', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it.each(['', '   ', '\t\n'])('renvoie une chaîne vide pour un nom vide (%j)', (name) => {
    expect(getInitials(name)).toBe('');
  });

  it('ignore les espaces en trop', () => {
    expect(getInitials('   Rachid    Tazi  ')).toBe('RT');
  });

  it('ne dépasse jamais 2 lettres', () => {
    expect(getInitials('A B C D').length).toBeLessThanOrEqual(2);
  });
});

describe('getInitial', () => {
  it.each([
    ['Rachid Tazi', 'R'],
    ['karim', 'K'],
    ['رشيد تازي', 'ر'],
    ['  Yassine ', 'Y'],
    ['', ''],
  ])('« %s » → « %s »', (name, expected) => {
    expect(getInitial(name)).toBe(expected);
  });
});
