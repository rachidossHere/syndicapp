import { z } from 'zod';

import { ROLES, type Role } from './roles';

/** Alphabet des codes d'invitation : sans 0, O, 1, I, L (faciles à confondre). 31 caractères. */
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const INVITE_CODE_LENGTH = 6;
/** Durée de validité d'une invitation, en jours. */
export const INVITE_VALIDITY_DAYS = 7;
export const INVITE_LINK_PREFIX = 'syndicapp://invite/';

/**
 * Normalise une saisie : majuscules, espaces et tirets retirés (« ab3-k9 x » → « AB3K9X »).
 * Ne dit pas si le code est valide : voir `isInviteCodeFormat`.
 */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s\-‐-―]/g, '');
}

/** Vrai si le code (déjà normalisé) a la bonne longueur et n'utilise que l'alphabet. */
export function isInviteCodeFormat(code: string): boolean {
  return (
    code.length === INVITE_CODE_LENGTH &&
    [...code].every((char) => INVITE_CODE_ALPHABET.includes(char))
  );
}

/** Lien profond d'une invitation. */
export const inviteLink = (code: string): string => `${INVITE_LINK_PREFIX}${code}`;

/** Clés de traduction des refus d'invitation (réponse `{ error: <clé> }`). */
export const INVITATION_ERRORS = {
  notFound: 'invitations.errors.notFound',
  expired: 'invitations.errors.expired',
  used: 'invitations.errors.used',
  revoked: 'invitations.errors.revoked',
  alreadyMember: 'invitations.errors.alreadyMember',
  lotHasTenant: 'invitations.errors.lotHasTenant',
  lotNotFound: 'invitations.errors.lotNotFound',
} as const;
export type InvitationErrorKey = (typeof INVITATION_ERRORS)[keyof typeof INVITATION_ERRORS];

/** Rôles qu'on peut proposer par invitation : tous sauf le syndic (passation au plan 09). */
export const INVITABLE_ROLES = ROLES.filter((role) => role !== 'manager') as Exclude<
  Role,
  'manager'
>[];

/** Rôles qui exigent un lot. */
const ROLES_WITH_LOT: readonly Role[] = ['owner', 'tenant'];

export const createInvitationSchema = z
  .object({
    role: z.enum(INVITABLE_ROLES as [Exclude<Role, 'manager'>, ...Exclude<Role, 'manager'>[]]),
    lotId: z.uuid().optional(),
  })
  .refine((value) => !ROLES_WITH_LOT.includes(value.role) || value.lotId !== undefined);
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Réponse à la création. */
export type CreatedInvitation = {
  id: string;
  code: string;
  link: string;
  role: Role;
  lotId: string | null;
  expiresAt: string;
};

/** Invitation en attente (liste du syndic). */
export type PendingInvitation = CreatedInvitation & { lotReference: string | null };

/** Aperçu avant acceptation : aucune donnée personnelle. */
export type InvitationPreview = {
  residence: { name: string; city: string };
  lotReference: string | null;
  role: Role;
  expiresAt: string;
};
