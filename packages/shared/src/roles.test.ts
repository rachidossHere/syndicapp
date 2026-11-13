import { describe, expect, it } from 'vitest';

import { can, PERMISSIONS, ROLE_LABEL_KEYS, ROLE_PERMISSIONS, ROLES } from './roles';

describe('table des permissions', () => {
  it("tenant n'a pas accounts.read", () => {
    expect(can('tenant', 'accounts.read')).toBe(false);
  });

  it('caretaker a issues.manage', () => {
    expect(can('caretaker', 'issues.manage')).toBe(true);
  });

  it('caretaker peut créer un signalement', () => {
    expect(can('caretaker', 'issues.write')).toBe(true);
  });

  it('tous les rôles peuvent signaler, seuls manager, deputy et caretaker traitent (plan 07)', () => {
    for (const role of ROLES) {
      expect(can(role, 'issues.write')).toBe(true);
      expect(can(role, 'issues.manage')).toBe(['manager', 'deputy', 'caretaker'].includes(role));
    }
  });

  it("owner n'a pas members.invite", () => {
    expect(can('owner', 'members.invite')).toBe(false);
  });

  it('manager a toutes les permissions', () => {
    for (const permission of PERMISSIONS) {
      expect(can('manager', permission)).toBe(true);
    }
  });

  it('seul manager peut inviter et gérer la résidence', () => {
    for (const role of ROLES) {
      expect(can(role, 'members.invite')).toBe(role === 'manager');
      expect(can(role, 'residence.manage')).toBe(role === 'manager');
    }
  });

  it("tenant et caretaker n'ont aucun accès aux comptes", () => {
    for (const role of ['tenant', 'caretaker'] as const) {
      expect(can(role, 'accounts.read')).toBe(false);
      expect(can(role, 'payments.write')).toBe(false);
      expect(can(role, 'expenses.write')).toBe(false);
    }
  });

  it('chaque rôle a une entrée, sans permission inconnue', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('chaque rôle a une clé de traduction roles.<code>', () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL_KEYS[role]).toBe(`roles.${role}`);
    }
  });
});
