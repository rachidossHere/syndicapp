import { describe, expect, it } from 'vitest';

import {
  createInvitationSchema,
  INVITABLE_ROLES,
  INVITE_CODE_ALPHABET,
  inviteLink,
  isInviteCodeFormat,
  normalizeInviteCode,
} from './invitations';

describe('codes d\'invitation', () => {
  it('exclut les caractères ambigus', () => {
    for (const char of '01OIL') expect(INVITE_CODE_ALPHABET).not.toContain(char);
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(INVITE_CODE_ALPHABET.length);
  });

  it('normalise la saisie', () => {
    expect(normalizeInviteCode(' ab3-k9 x ')).toBe('AB3K9X');
    expect(normalizeInviteCode('ab3–k9x')).toBe('AB3K9X');
  });

  it('valide le format', () => {
    expect(isInviteCodeFormat('AB3K9X')).toBe(true);
    expect(isInviteCodeFormat('AB3K9')).toBe(false);
    expect(isInviteCodeFormat('AB3K9O')).toBe(false);
    expect(isInviteCodeFormat('AB3K9XX')).toBe(false);
  });

  it('construit le lien profond', () => {
    expect(inviteLink('AB3K9X')).toBe('syndicapp://invite/AB3K9X');
  });
});

describe('createInvitationSchema', () => {
  const lotId = '0b6f5f4e-6d0f-4c1c-8f43-3d6c1a0f7a11';

  it('refuse le rôle manager', () => {
    expect(INVITABLE_ROLES).not.toContain('manager');
    expect(createInvitationSchema.safeParse({ role: 'manager', lotId }).success).toBe(false);
  });

  it('exige un lot pour owner et tenant, pas pour caretaker', () => {
    expect(createInvitationSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ role: 'tenant' }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ role: 'owner', lotId }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ role: 'caretaker' }).success).toBe(true);
  });
});
