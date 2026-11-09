import { ROLES, type Role } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { canManageCharges, canSeeMyCharges, myDuesResidenceId } from './access';

describe('« Mes charges » selon le rôle', () => {
  it('seul le copropriétaire voit ses charges', () => {
    const seen = ROLES.filter((role) => canSeeMyCharges(role));
    expect(seen).toEqual(['owner']);
  });

  it('copropriétaire : la requête vise sa résidence', () => {
    expect(myDuesResidenceId({ id: 'res-1', role: 'owner' })).toBe('res-1');
  });

  it.each<Role>(['tenant', 'caretaker', 'manager', 'treasurer', 'deputy'])(
    '%s : requête désactivée, aucun appel aux routes de charges',
    (role) => {
      expect(myDuesResidenceId({ id: 'res-1', role })).toBeUndefined();
    },
  );

  it('sans résidence active : requête désactivée', () => {
    expect(myDuesResidenceId(null)).toBeUndefined();
    expect(myDuesResidenceId(undefined)).toBeUndefined();
  });

  it('locataire, gardien et copropriétaire n’ont pas l’écran de gestion des charges', () => {
    expect(canManageCharges('tenant')).toBe(false);
    expect(canManageCharges('caretaker')).toBe(false);
    expect(canManageCharges('owner')).toBe(false);
    expect(canManageCharges('manager')).toBe(true);
    expect(canManageCharges('treasurer')).toBe(true);
  });
});
