import { can, type Role } from '@syndic/shared';

/**
 * Écrans « Charges » du syndic et du trésorier : lecture des comptes, et encaissement ou lancement
 * d'appels. L'adjoint (lecture seule) et le copropriétaire n'y ont pas accès (l'API refuse de toute façon).
 */
export const canManageCharges = (role: Role): boolean =>
  can(role, 'accounts.read') && (can(role, 'payments.write') || can(role, 'charges.write'));
