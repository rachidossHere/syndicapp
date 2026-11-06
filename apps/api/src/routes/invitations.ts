import { db, schema } from '@syndic/db';
import {
  createInvitationSchema,
  INVITATION_ERRORS,
  inviteLink,
  isInviteCodeFormat,
  normalizeInviteCode,
  type CreatedInvitation,
  type InvitationErrorKey,
  type PendingInvitation,
} from '@syndic/shared';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { limitInviteAttempts } from '../rate-limit';
import { generateInviteCode, inviteExpiry } from '../services/invitations';
import { parseJson } from '../validate';

export const invitations = new Hono<MembershipEnv>();

const MAX_CODE_ATTEMPTS = 5;

/** Statut HTTP de chaque refus : 404 inconnu, 410 expiré / utilisé / annulé, 409 conflit. */
export const INVITATION_ERROR_STATUS = {
  [INVITATION_ERRORS.notFound]: 404,
  [INVITATION_ERRORS.expired]: 410,
  [INVITATION_ERRORS.used]: 410,
  [INVITATION_ERRORS.revoked]: 410,
  [INVITATION_ERRORS.alreadyMember]: 409,
  [INVITATION_ERRORS.lotHasTenant]: 409,
  [INVITATION_ERRORS.lotNotFound]: 400,
} as const satisfies Record<InvitationErrorKey, 400 | 404 | 409 | 410>;

/** Réponse de refus `{ error: <clé de traduction> }`. */
export const refusal = (key: InvitationErrorKey) =>
  Response.json({ error: key }, { status: INVITATION_ERROR_STATUS[key] });

const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === '23505';
};

/** Syndic (members.invite) : crée une invitation pour un lot et un rôle. */
invitations.post(
  '/',
  requireAuth,
  requireMembership,
  requirePermission('members.invite'),
  async (c) => {
    const input = await parseJson(c, createInvitationSchema);
    const residenceId = c.get('residenceId');

    // Le lot doit appartenir à la résidence active (même réponse s'il n'existe pas du tout).
    if (input.lotId) {
      const [found] = await db
        .select({ id: schema.lot.id })
        .from(schema.lot)
        .where(and(eq(schema.lot.id, input.lotId), eq(schema.lot.residenceId, residenceId)))
        .limit(1);
      if (!found) return refusal(INVITATION_ERRORS.lotNotFound);
    }

    const expiresAt = inviteExpiry();
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateInviteCode();
      try {
        const [row] = await db
          .insert(schema.invitation)
          .values({
            residenceId,
            lotId: input.lotId ?? null,
            role: input.role,
            code,
            expiresAt,
            createdBy: c.get('user').id,
          })
          .returning({ id: schema.invitation.id });
        const body: CreatedInvitation = {
          id: row!.id,
          code,
          link: inviteLink(code),
          role: input.role,
          lotId: input.lotId ?? null,
          expiresAt: expiresAt.toISOString(),
        };
        return c.json(body, 201);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error; // code déjà pris : on en tire un autre
      }
    }
    throw new Error('invitation_code_unavailable');
  },
);

/** Syndic : invitations en attente (ni utilisées, ni annulées, ni expirées) de la résidence. */
invitations.get(
  '/',
  requireAuth,
  requireMembership,
  requirePermission('members.invite'),
  async (c) => {
    const residenceId = c.get('residenceId');
    const rows = await db
      .select({
        id: schema.invitation.id,
        code: schema.invitation.code,
        role: schema.invitation.role,
        lotId: schema.invitation.lotId,
        lotReference: schema.lot.reference,
        expiresAt: schema.invitation.expiresAt,
      })
      .from(schema.invitation)
      .leftJoin(schema.lot, eq(schema.lot.id, schema.invitation.lotId))
      .where(
        and(
          eq(schema.invitation.residenceId, residenceId),
          isNull(schema.invitation.usedAt),
          isNull(schema.invitation.revokedAt),
          gt(schema.invitation.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.invitation.createdAt));
    const result: PendingInvitation[] = rows.map((row) => ({
      ...row,
      link: inviteLink(row.code),
      expiresAt: row.expiresAt.toISOString(),
    }));
    return c.json({ invitations: result });
  },
);

/** Syndic : annule une invitation de sa résidence (revoked_at). Celle d'une autre résidence : 404. */
invitations.delete(
  '/:id',
  requireAuth,
  requireMembership,
  requirePermission('members.invite'),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) throw new HTTPException(404);
    const residenceId = c.get('residenceId');

    const [found] = await db
      .select({ usedAt: schema.invitation.usedAt })
      .from(schema.invitation)
      .where(and(eq(schema.invitation.id, id.data), eq(schema.invitation.residenceId, residenceId)))
      .limit(1);
    if (!found) throw new HTTPException(404);
    if (found.usedAt) return refusal(INVITATION_ERRORS.used);

    await db
      .update(schema.invitation)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.invitation.id, id.data),
          eq(schema.invitation.residenceId, residenceId),
          isNull(schema.invitation.usedAt),
          isNull(schema.invitation.revokedAt),
        ),
      );
    return c.body(null, 204);
  },
);

/** Invitation correspondant à un code saisi, avec la résidence et le lot. */
async function findByCode(rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  if (!isInviteCodeFormat(code)) return undefined;
  const [row] = await db
    .select({
      id: schema.invitation.id,
      residenceId: schema.invitation.residenceId,
      lotId: schema.invitation.lotId,
      role: schema.invitation.role,
      expiresAt: schema.invitation.expiresAt,
      usedAt: schema.invitation.usedAt,
      revokedAt: schema.invitation.revokedAt,
      residenceName: schema.residence.name,
      residenceCity: schema.residence.city,
      lotReference: schema.lot.reference,
    })
    .from(schema.invitation)
    .innerJoin(schema.residence, eq(schema.residence.id, schema.invitation.residenceId))
    .leftJoin(schema.lot, eq(schema.lot.id, schema.invitation.lotId))
    .where(eq(schema.invitation.code, code))
    .limit(1);
  return row;
}

/** Clé de refus selon l'état de l'invitation, ou `undefined` si elle est utilisable. */
function stateError(row: { revokedAt: Date | null; usedAt: Date | null; expiresAt: Date }) {
  if (row.revokedAt) return INVITATION_ERRORS.revoked;
  if (row.usedAt) return INVITATION_ERRORS.used;
  if (row.expiresAt <= new Date()) return INVITATION_ERRORS.expired;
  return undefined;
}

/** Aperçu d'un code (sans X-Residence-Id) : résidence, lot et rôle, aucune donnée personnelle. */
invitations.get('/preview/:code', requireAuth, limitInviteAttempts, async (c) => {
  const row = await findByCode(c.req.param('code'));
  if (!row) return refusal(INVITATION_ERRORS.notFound);
  const error = stateError(row);
  if (error) return refusal(error);
  return c.json({
    residence: { name: row.residenceName, city: row.residenceCity },
    lotReference: row.lotReference,
    role: row.role,
    expiresAt: row.expiresAt.toISOString(),
  });
});

/** Refus levé dans la transaction d'acceptation : annule tout, puis devient une réponse `refusal`. */
class AcceptRefusal extends Error {
  constructor(readonly key: InvitationErrorKey) {
    super(key);
  }
}

/**
 * Accepte un code (sans X-Residence-Id) : crée le membership et marque l'invitation utilisée, dans
 * une seule transaction. La ligne de la résidence est verrouillée (`for update`) : les acceptations
 * d'une même résidence passent l'une après l'autre, donc les contrôles « déjà membre » et « lot déjà
 * loué » ne peuvent pas être contournés par deux requêtes simultanées. Le marquage « utilisée » est
 * une mise à jour conditionnelle (`where used_at is null`) : un code ne sert qu'une fois.
 */
invitations.post('/accept/:code', requireAuth, limitInviteAttempts, async (c) => {
  const found = await findByCode(c.req.param('code'));
  if (!found) return refusal(INVITATION_ERRORS.notFound);
  const userId = c.get('user').id;

  try {
    const membership = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select 1 from ${schema.residence} where ${schema.residence.id} = ${found.residenceId} for update`,
      );

      // 1. Marquage conditionnel : seul le premier arrivé obtient la ligne.
      const [claimed] = await tx
        .update(schema.invitation)
        .set({ usedAt: new Date(), usedBy: userId })
        .where(
          and(
            eq(schema.invitation.id, found.id),
            isNull(schema.invitation.usedAt),
            isNull(schema.invitation.revokedAt),
            gt(schema.invitation.expiresAt, new Date()),
          ),
        )
        .returning({ id: schema.invitation.id });
      if (!claimed) {
        // Perdu (ou invitation devenue inutilisable) : on relit l'état pour donner la bonne clé.
        const [current] = await tx
          .select({
            usedAt: schema.invitation.usedAt,
            revokedAt: schema.invitation.revokedAt,
            expiresAt: schema.invitation.expiresAt,
          })
          .from(schema.invitation)
          .where(eq(schema.invitation.id, found.id))
          .limit(1);
        throw new AcceptRefusal((current && stateError(current)) ?? INVITATION_ERRORS.notFound);
      }

      // 2. Déjà membre actif de cette résidence ?
      const [already] = await tx
        .select({ id: schema.membership.id })
        .from(schema.membership)
        .where(
          and(
            eq(schema.membership.residenceId, found.residenceId),
            eq(schema.membership.userId, userId),
            eq(schema.membership.active, true),
          ),
        )
        .limit(1);
      if (already) throw new AcceptRefusal(INVITATION_ERRORS.alreadyMember);

      // 3. Un seul locataire actif par lot (plusieurs copropriétaires sont permis).
      if (found.role === 'tenant' && found.lotId) {
        const [tenant] = await tx
          .select({ id: schema.membership.id })
          .from(schema.membership)
          .where(
            and(
              eq(schema.membership.residenceId, found.residenceId),
              eq(schema.membership.lotId, found.lotId),
              eq(schema.membership.role, 'tenant'),
              eq(schema.membership.active, true),
            ),
          )
          .limit(1);
        if (tenant) throw new AcceptRefusal(INVITATION_ERRORS.lotHasTenant);
      }

      const [created] = await tx
        .insert(schema.membership)
        .values({
          residenceId: found.residenceId,
          userId,
          role: found.role,
          lotId: found.lotId,
        })
        .returning({ id: schema.membership.id });
      return created!;
    });

    return c.json(
      {
        membershipId: membership.id,
        residenceId: found.residenceId,
        role: found.role,
        lotId: found.lotId,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AcceptRefusal) return refusal(error.key);
    throw error;
  }
});
