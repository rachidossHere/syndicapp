import { can, type Role } from '@syndic/shared';

/**
 * Écrans « Charges » du syndic et du trésorier : lecture des comptes, et encaissement ou lancement
 * d'appels. L'adjoint (lecture seule) et le copropriétaire n'y ont pas accès (l'API refuse de toute façon).
 */
export const canManageCharges = (role: Role): boolean =>
  can(role, 'accounts.read') && (can(role, 'payments.write') || can(role, 'charges.write'));

/** « Mes charges » : réservé au copropriétaire (locataire et gardien ne voient aucune charge). */
export const canSeeMyCharges = (role: Role): boolean => role === 'owner';

/**
 * Résidence pour laquelle charger mes dus : uniquement celle où je suis copropriétaire.
 * `undefined` désactive la requête : un locataire ou un gardien n'appelle jamais les routes de charges.
 */
export const myDuesResidenceId = (active: { id: string; role: Role } | null | undefined): string | undefined =>
  active && canSeeMyCharges(active.role) ? active.id : undefined;
