import { db, schema, sql } from '@syndic/db';
import {
  bulkLotsSchema,
  createLotSchema,
  generateBulkLots,
  LOT_BLOCKER_ERRORS,
  LOT_ERRORS,
  updateLotSchema,
  type LotDeleteBlocker,
  type LotStatus,
} from '@syndic/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { lotRefusal } from '../lot-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { parseJson } from '../validate';

export const lots = new Hono<MembershipEnv>();

/** Code Postgres de l'erreur (Drizzle l'enveloppe dans `cause`). */
const codeOf = (error: unknown): string | undefined => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
};
const isUniqueViolation = (error: unknown): boolean => codeOf(error) === '23505';
const isForeignKeyViolation = (error: unknown): boolean => codeOf(error) === '23503';

const lotColumns = {
  id: schema.lot.id,
  reference: schema.lot.reference,
  building: schema.lot.building,
  floor: schema.lot.floor,
  type: schema.lot.type,
};

const naturalOrder = new Intl.Collator('fr', { numeric: true });
const byReference = (a: string, b: string) => naturalOrder.compare(a, b);

const lotIdSchema = z.uuid();
/** Identifiant de lot de l'URL : 400 s'il n'est pas un uuid (jamais d'erreur SQL). */
function lotIdParam(value: string): string {
  const parsed = lotIdSchema.safeParse(value);
  if (!parsed.success) throw new HTTPException(400);
  return parsed.data;
}

/**
 * Ce qui rattache un lot au reste de la résidence. Toujours filtré sur la résidence.
 * - `hasActiveMember` et `hasPendingInvitation` donnent le statut affiché (membre, en attente) ;
 * - `hasAnyMember` compte aussi les membres partis : leur historique reste rattaché au lot.
 */
const lotLinks = (residenceId: string) => ({
  hasActiveMember: sql<boolean>`exists (
    select 1 from ${schema.membership}
    where ${schema.membership.lotId} = "lot"."id"
      and ${schema.membership.residenceId} = ${residenceId}
      and ${schema.membership.active})`,
  hasAnyMember: sql<boolean>`exists (
    select 1 from ${schema.membership}
    where ${schema.membership.lotId} = "lot"."id"
      and ${schema.membership.residenceId} = ${residenceId})`,
  hasPendingInvitation: sql<boolean>`exists (
    select 1 from ${schema.invitation}
    where ${schema.invitation.lotId} = "lot"."id"
      and ${schema.invitation.residenceId} = ${residenceId}
      and ${schema.invitation.usedAt} is null
      and ${schema.invitation.revokedAt} is null
      and ${schema.invitation.expiresAt} > now())`,
  // Colonnes qualifiées à la main : Drizzle retire le préfixe de table dans un select à une table,
  // et « id » serait ambigu entre charge_due et payment.
  hasPayment: sql<boolean>`exists (
    select 1 from "charge_due" as "cd"
    join "payment" as "p" on "p"."charge_due_id" = "cd"."id" and "p"."residence_id" = ${residenceId}
    where "cd"."lot_id" = "lot"."id" and "cd"."residence_id" = ${residenceId})`,
  hasCharge: sql<boolean>`exists (
    select 1 from ${schema.chargeDue}
    where ${schema.chargeDue.lotId} = "lot"."id"
      and ${schema.chargeDue.residenceId} = ${residenceId})`,
  hasIssue: sql<boolean>`exists (
    select 1 from ${schema.issue}
    where ${schema.issue.authorLotId} = "lot"."id"
      and ${schema.issue.residenceId} = ${residenceId})`,
});

type LotLinks = {
  hasAnyMember: boolean;
  hasPendingInvitation: boolean;
  hasPayment: boolean;
  hasCharge: boolean;
  hasIssue: boolean;
};

/** Premier obstacle à la suppression (ordre de `LOT_DELETE_BLOCKERS`), ou `null` si le lot est vide. */
function deleteBlocker(links: LotLinks): LotDeleteBlocker | null {
  if (links.hasAnyMember) return 'member';
  if (links.hasPendingInvitation) return 'invitation';
  if (links.hasPayment) return 'payment';
  if (links.hasCharge) return 'charge';
  if (links.hasIssue) return 'issue';
  return null;
}

lots.post('/', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const input = await parseJson(c, createLotSchema);
  const residenceId = c.get('residenceId');
  try {
    const [created] = await db
      .insert(schema.lot)
      .values({
        residenceId,
        reference: input.reference,
        building: input.building ?? null,
        floor: input.floor ?? null,
        type: input.type,
      })
      .returning(lotColumns);
    return c.json(created, 201);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return c.json({ error: 'conflict', references: [input.reference] }, 409);
  }
});

/**
 * Génération rapide. Les références déjà présentes dans la résidence sont ignorées (sans erreur) :
 * un seul `insert … on conflict do nothing` dans une transaction. La contrainte unique
 * (residence_id, reference) garantit que deux appels simultanés ne créent jamais de doublon.
 */
lots.post('/bulk', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const input = await parseJson(c, bulkLotsSchema);
  const residenceId = c.get('residenceId');
  const generated = generateBulkLots(input);

  const created = await db.transaction((tx) =>
    tx
      .insert(schema.lot)
      .values(generated.map((lot) => ({ ...lot, residenceId, type: 'apartment' as const })))
      .onConflictDoNothing({ target: [schema.lot.residenceId, schema.lot.reference] })
      .returning(lotColumns),
  );
  created.sort((a, b) => byReference(a.reference, b.reference));
  return c.json(
    { created: created.length, skipped: generated.length - created.length, lots: created },
    created.length > 0 ? 201 : 200,
  );
});

/**
 * Syndic (lots.write) : lots de la résidence, triés par référence, avec leur statut (member,
 * pending, free) et, s'il y en a un, ce qui empêche de les supprimer. Ces informations révèlent
 * qui est membre ou invité : réservé à celui qui gère les lots.
 */
lots.get('/', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const residenceId = c.get('residenceId');
  const rows = await db
    .select({ ...lotColumns, ...lotLinks(residenceId) })
    .from(schema.lot)
    .where(eq(schema.lot.residenceId, residenceId));

  const result = rows
    .map(({ hasActiveMember, hasAnyMember, hasPendingInvitation, hasPayment, hasCharge, hasIssue, ...lot }) => ({
      ...lot,
      status: (hasActiveMember ? 'member' : hasPendingInvitation ? 'pending' : 'free') satisfies LotStatus,
      deleteBlocker: deleteBlocker({ hasAnyMember, hasPendingInvitation, hasPayment, hasCharge, hasIssue }),
    }))
    .sort((a, b) => byReference(a.reference, b.reference));
  return c.json({ lots: result });
});

/** Modifie la référence d'un appartement. Membres, invitations, charges et paiements restent liés (id inchangé). */
lots.patch('/:id', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const input = await parseJson(c, updateLotSchema);
  const residenceId = c.get('residenceId');
  const id = lotIdParam(c.req.param('id'));
  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.lot)
        .set({ reference: input.reference })
        .where(and(eq(schema.lot.id, id), eq(schema.lot.residenceId, residenceId)))
        .returning(lotColumns);
      return row;
    });
    if (!updated) return lotRefusal(LOT_ERRORS.notFound);
    return c.json(updated);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return lotRefusal(LOT_ERRORS.referenceExists);
  }
});

/**
 * Supprime un appartement vide : ni membre (même parti), ni invitation en cours, ni charge, ni
 * paiement, ni signalement. Sinon 409 avec la raison. La ligne du lot est verrouillée pendant la
 * vérification : une invitation créée au même moment attend la fin de la suppression, puis échoue
 * sur la clé étrangère. Les invitations terminées (annulées ou expirées) du lot sont retirées avec lui.
 */
lots.delete('/:id', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const residenceId = c.get('residenceId');
  const id = lotIdParam(c.req.param('id'));
  try {
    const outcome = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: schema.lot.id })
        .from(schema.lot)
        .where(and(eq(schema.lot.id, id), eq(schema.lot.residenceId, residenceId)))
        .for('update');
      if (!locked) return 'not_found' as const;

      const [links] = await tx
        .select(lotLinks(residenceId))
        .from(schema.lot)
        .where(and(eq(schema.lot.id, id), eq(schema.lot.residenceId, residenceId)));
      const blocker = links ? deleteBlocker(links) : null;
      if (blocker !== null) return blocker;

      await tx
        .delete(schema.invitation)
        .where(
          and(
            eq(schema.invitation.lotId, id),
            eq(schema.invitation.residenceId, residenceId),
            isNull(schema.invitation.usedAt),
          ),
        );
      await tx
        .delete(schema.lot)
        .where(and(eq(schema.lot.id, id), eq(schema.lot.residenceId, residenceId)));
      return 'deleted' as const;
    });

    if (outcome === 'not_found') return lotRefusal(LOT_ERRORS.notFound);
    if (outcome !== 'deleted') return lotRefusal(LOT_BLOCKER_ERRORS[outcome]);
    return c.body(null, 204);
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
    return lotRefusal(LOT_ERRORS.inUse);
  }
});
