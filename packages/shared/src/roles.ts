import { z } from 'zod';

/**
 * Rôles d'un membre dans une résidence (source unique, AGENTS.md section 2).
 * Les codes sont en anglais ; les libellés affichés passent par les traductions (`ROLE_LABEL_KEYS`).
 */
export const ROLES = ['manager', 'treasurer', 'deputy', 'owner', 'tenant', 'caretaker'] as const;

export type Role = (typeof ROLES)[number];

export const roleSchema = z.enum(ROLES);

/** Rôle unique et obligatoire de chaque résidence (le syndic). */
export const MANAGER_ROLE = 'manager' as const satisfies Role;

/** Permissions vérifiées par l'API (`requirePermission`). L'appli ne fait que masquer. */
export const PERMISSIONS = [
  'residence.manage', // modifier la résidence, gérer les membres, passation
  'lots.write', // créer et modifier les lots
  'members.invite', // créer et annuler des invitations
  'accounts.read', // consulter les comptes de la résidence (caisse, dépenses)
  'charges.write', // créer les appels de charges
  'payments.write', // enregistrer les encaissements
  'expenses.write', // enregistrer les dépenses
  'issues.write', // créer un signalement
  'issues.manage', // traiter les signalements (statut, prise en charge)
  'announcements.write', // publier des annonces
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Table rôle → permissions, conforme à AGENTS.md section 2. */
export const ROLE_PERMISSIONS = {
  manager: PERMISSIONS,
  treasurer: ['accounts.read', 'payments.write', 'expenses.write', 'issues.write'],
  deputy: ['accounts.read', 'announcements.write', 'issues.write', 'issues.manage'],
  owner: ['accounts.read', 'issues.write'],
  tenant: ['issues.write'],
  caretaker: ['issues.write', 'issues.manage'],
} as const satisfies Record<Role, readonly Permission[]>;

/** Indique si un rôle possède une permission. */
export function can(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

/** Clés de traduction des libellés de rôles (`fr.ts` / `ar.ts` de l'appli). */
export const ROLE_LABEL_KEYS = {
  manager: 'roles.manager',
  treasurer: 'roles.treasurer',
  deputy: 'roles.deputy',
  owner: 'roles.owner',
  tenant: 'roles.tenant',
  caretaker: 'roles.caretaker',
} as const satisfies Record<Role, `roles.${Role}`>;

export type RoleLabelKey = (typeof ROLE_LABEL_KEYS)[Role];

/** Types de lot. */
export const LOT_TYPES = ['apartment', 'commercial', 'other'] as const;

export type LotType = (typeof LOT_TYPES)[number];
