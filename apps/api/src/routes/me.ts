import { db, schema } from '@syndic/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';

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

/**
 * Mes charges (accounts.read) : uniquement les dus des lots dont je suis copropriétaire actif
 * (membership `owner`) dans la résidence active, avec mes paiements et numéros de reçu.
 * Aucun autre lot, aucun nom de personne. Un locataire n'a pas accounts.read : 403.
 */
me.get('/dues', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const residenceId = c.get('residenceId');
  const myLots = db
    .select({ lotId: schema.membership.lotId })
    .from(schema.membership)
    .where(
      and(
        eq(schema.membership.userId, c.get('user').id),
        eq(schema.membership.residenceId, residenceId),
        eq(schema.membership.role, 'owner'),
        eq(schema.membership.active, true),
      ),
    );

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
    .where(and(eq(schema.chargeDue.residenceId, residenceId), inArray(schema.chargeDue.lotId, myLots)))
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
