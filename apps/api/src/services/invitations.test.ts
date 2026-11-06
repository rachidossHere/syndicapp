import { INVITE_CODE_ALPHABET, isInviteCodeFormat } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { generateInviteCode, inviteExpiry } from './invitations';

describe('generateInviteCode', () => {
  it('produit des codes de 6 caractères de l\'alphabet, variés', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateInviteCode();
      expect(isInviteCodeFormat(code)).toBe(true);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(1990);
    // Tous les caractères de l'alphabet finissent par sortir.
    const seen = new Set([...codes].join(''));
    expect(seen.size).toBe(INVITE_CODE_ALPHABET.length);
  });
});

describe('inviteExpiry', () => {
  it('ajoute 7 jours', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(inviteExpiry(from).toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });
});
