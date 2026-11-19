import { db, schema, sql } from '@syndic/db';
import { myDuesListQuerySchema, myDuesSummaryQuerySchema, type MyDuesYearSummary } from '@syndic/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { paymentsByDue } from '../services/charges';

export const me = new Hono<MembershipEnv>();

/** Utilisateur connecté : uniquement `id`, `name` et `email` (jamais la session ni le jeton). */
me.get('/', requireAuth, (c) => {
  const { id, name, email } = c.get('user');
  return c.json({ id, name, email });
});

/** Lots dont je suis copropriétaire actif dans la résidence : la seule porte d'entrée vers des dus. */
function myLotsOf(residenceId: string, userId: string) {
  return db
    .select({ lotId: schema.membership.lotId })
    .from(schema.membership)
    .where(
      and(
        eq(schema.membership.userId, userId),
        eq(schema.membership.residenceId, residenceId),
        eq(schema.membership.role, 'owner'),
        eq(schema.membership.active, true),
      ),
    );
}

/** Année d'un appel : les 4 premiers caractères de son libellé de période (« 2026-Q4 », « 2026-11 »). */
const callYear = sql<string>`substring(${schema.chargeCall.periodLabel} from 1 for 4)`;

/**
 * Résumé de mes charges par année (accounts.read) : « N payés sur M » et le total payé, uniquement pour
 * les lots dont je suis copropriétaire. Sans charger un seul dû : c'est ce qu'affiche chaque section
 * fermée de « Mes charges ». Déclarée avant `/dues` pour plus de lisibilité (chemins distincts).
 */
me.get('/dues/summary', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  if (!myDuesSummaryQuerySchema.safeParse(c.req.query()).success) throw new HTTPException(400);
  const residenceId = c.get('residenceId');
  const due = schema.chargeDue;
  const rows = await db
    .select({
      year: callYear,
      dueCount: sql`count(${due.id})`.mapWith(Number),
      paidCount: sql`count(${due.id}) filter (where ${due.status} = 'paid')`.mapWith(Number),
      totalPaid: sql`coalesce(sum(${due.amountPaid}), 0)`.mapWith(Number),
    })
    .from(due)
    .innerJoin(
      schema.chargeCall,
      and(eq(schema.chargeCall.id, due.chargeCallId), eq(schema.chargeCall.residenceId, residenceId)),
    )
    .where(and(eq(due.residenceId, residenceId), inArray(due.lotId, myLotsOf(residenceId, c.get('user').id))))
    .groupBy(callYear)
    .orderBy(desc(callYear));
  const years: MyDuesYearSummary[] = rows;
  return c.json({ years });
});

/**
 * Mes charges (accounts.read) : uniquement les dus des lots dont je suis copropriétaire actif
 * (membership `owner`) dans la résidence active, avec mes paiements et numéros de reçu.
 * Aucun autre lot, aucun nom de personne. Un locataire n'a pas accounts.read : 403.
 * `?year=2026` ne garde que les dus des appels de cette année.
 */
me.get('/dues', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const query = myDuesListQuerySchema.safeParse(c.req.query());
  if (!query.success) throw new HTTPException(400);
  const residenceId = c.get('residenceId');
  const myLots = myLotsOf(residenceId, c.get('user').id);

  const dues = await db
    .select({
      id: schema.chargeDue.id,
      chargeCallId: schema.chargeCall.id,
      periodLabel: schema.chargeCall.periodLabel,
      dueDate: schema.chargeCall.dueDate,
      lotReference: schema.lot.reference,
      amountDue: schema.chargeDue.amountDue,
      amountPaid: schema.chargeDue.amountPaid,
      status: schema.chargeDue.status,
    })
    .from(schema.chargeDue)
    .innerJoin(
      schema.chargeCall,
      and(
        eq(schema.chargeCall.id, schema.chargeDue.chargeCallId),
        eq(schema.chargeCall.residenceId, residenceId),
      ),
    )
    .innerJoin(
      schema.lot,
      and(eq(schema.lot.id, schema.chargeDue.lotId), eq(schema.lot.residenceId, residenceId)),
    )
    .where(
      and(
        eq(schema.chargeDue.residenceId, residenceId),
        inArray(schema.chargeDue.lotId, myLots),
        query.data.year === undefined ? undefined : sql`${callYear} = ${query.data.year}`,
      ),
    )
    .orderBy(desc(schema.chargeCall.dueDate), schema.lot.reference);

  const payments = await paymentsByDue(
    residenceId,
    dues.map((d) => d.id),
  );
  return c.json({
    dues: dues.map((d) => ({
      ...d,
      remaining: d.amountDue - d.amountPaid,
      // Motif d'annulation non transmis : texte libre du syndic, réservé aux encaisseurs.
      payments: (payments.get(d.id) ?? []).map(({ cancelReason: _reason, ...p }) => p),
    })),
  });
});
