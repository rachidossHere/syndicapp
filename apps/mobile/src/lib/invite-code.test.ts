import { describe, expect, it } from 'vitest';

import { daysUntil, formatInviteCode, previewReferences, sanitizeInviteInput } from './invite-code';

describe('sanitizeInviteInput', () => {
  it('met en majuscules et retire espaces et tirets (collage d’un code entier)', () => {
    expect(sanitizeInviteInput('k7q-4mx')).toBe('K7Q4MX');
    expect(sanitizeInviteInput(' k7q 4mx ')).toBe('K7Q4MX');
  });

  it('retire les caractères hors alphabet (0, O, 1, I, L) et limite à 6', () => {
    expect(sanitizeInviteInput('K0O7Q1IL4MXZZ')).toBe('K7Q4MX');
  });

  it('extrait le code d’un lien profond collé', () => {
    expect(sanitizeInviteInput('syndicapp://invite/K7Q4MX')).toBe('K7Q4MX');
  });

  it('accepte une saisie partielle', () => {
    expect(sanitizeInviteInput('k7')).toBe('K7');
    expect(sanitizeInviteInput('')).toBe('');
  });
});

describe('formatInviteCode', () => {
  it('sépare en deux groupes de trois', () => {
    expect(formatInviteCode('K7Q4MX')).toBe('K7Q 4MX');
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  it('arrondit au jour supérieur', () => {
    expect(daysUntil('2026-11-13T12:00:00Z', now)).toBe(7);
    expect(daysUntil('2026-11-11T13:00:00Z', now)).toBe(6);
  });
  it('reste à 1 minimum', () => {
    expect(daysUntil('2026-11-06T12:30:00Z', now)).toBe(1);
  });
});

describe('previewReferences', () => {
  it('montre tout jusqu’à 8 références', () => {
    const refs = ['A11', 'A12', 'A13'];
    expect(previewReferences(refs)).toEqual({ shown: refs, hasGap: false });
  });
  it('résume au-delà : 5 premières et 2 dernières', () => {
    const refs = Array.from({ length: 24 }, (_, i) => `R${i + 1}`);
    expect(previewReferences(refs)).toEqual({
      shown: ['R1', 'R2', 'R3', 'R4', 'R5', 'R23', 'R24'],
      hasGap: true,
    });
  });
});
