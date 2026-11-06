import { db, schema, sql } from '@syndic/db';
import { bulkLotsSchema, createLotSchema, generateBulkLots, type LotStatus } from '@syndic/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { parseJson } from '../validate';

export const lots = new Hono<MembershipEnv>();

/** Code Postgres de l'erreur (Drizzle l'enveloppe dans `cause`). */
const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === '23505';
};

const lotColumns = {
  id: schema.lot.id,
  reference: schema.lot.reference,
  building: schema.lot.building,
  floor: schema.lot.floor,
  type: schema.lot.type,
};

const naturalOrder = new Intl.Collator('fr', { numeric: true });
const byReference = (a: string, b: string) => naturalOrder.compare(a, b);

/** Références déjà utilisées dans la résidence parmi `references`. */
async function existingReferences(residenceId: string, references: string[]): Promise<string[]> {
  const rows = await db
    .select({ reference: schema.lot.reference })
    .from(schema.lot)
    .where(and(eq(schema.lot.residenceId, residenceId), inArray(schema.lot.reference, references)));
  return rows.map((row) => row.reference).sort(byReference);
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

lots.post('/bulk', requireAuth, requireMembership, requirePermission('lots.write'), async (c) => {
  const input = await parseJson(c, bulkLotsSchema);
  const residenceId = c.get('residenceId');
  const generated = generateBulkLots(input);
  const references = generated.map((lot) => lot.reference);

  // Tout ou rien : un conflit connu renvoie 409 avant toute écriture ; un conflit concurrent
  // fait échouer l'insertion, qui annule la transaction entière.
  const conflicts = await existingReferences(residenceId, references);
  if (conflicts.length > 0) {
    return c.json({ error: 'conflict', references: conflicts }, 409);
  }
  try {
    const created = await db.transaction((tx) =>
      tx
        .insert(schema.lot)
        .values(generated.map((lot) => ({ ...lot, residenceId, type: 'apartment' as const })))
        .returning(lotColumns),
    );
    return c.json({ count: created.length, lots: created }, 201);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return c.json(
      { error: 'conflict', references: await existingReferences(residenceId, references) },
      409,
    );
  }
});

/** Lots de la résidence, triés par référence, avec leur statut (member, pending, free). */
lots.get('/', requireAuth, requireMembership, async (c) => {
  const residenceId = c.get('residenceId');
  const rows = await db
    .select({
      ...lotColumns,
      hasMember: sql<boolean>`exists (
        select 1 from ${schema.membership}
        where ${schema.membership.lotId} = ${schema.lot.id}
          and ${schema.membership.residenceId} = ${residenceId}
          and ${schema.membership.active})`,
      hasInvitation: sql<boolean>`exists (
        select 1 from ${schema.invitation}
        where ${schema.invitation.lotId} = ${schema.lot.id}
          and ${schema.invitation.residenceId} = ${residenceId}
          and ${schema.invitation.usedAt} is null
          and ${schema.invitation.revokedAt} is null
          and ${schema.invitation.expiresAt} > now())`,
    })
    .from(schema.lot)
    .where(eq(schema.lot.residenceId, residenceId));

  const result = rows
    .map(({ hasMember, hasInvitation, ...lot }) => ({
      ...lot,
      status: (hasMember ? 'member' : hasInvitation ? 'pending' : 'free') satisfies LotStatus,
    }))
    .sort((a, b) => byReference(a.reference, b.reference));
  return c.json({ lots: result });
});
