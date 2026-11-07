import { db, nextReceiptNumber, schema, sql } from '@syndic/db';
import {
  CHARGE_ERRORS,
  cancelPaymentSchema,
  computeDueStatus,
  createPaymentSchema,
  todayInCasablanca,
} from '@syndic/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { ChargeRefusal, chargeRefusal, withRefusals } from '../charge-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { parseJson } from '../validate';

export const payments = new Hono<MembershipEnv>();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Verrouille le dû (`for update`) jusqu'à la fin de la transaction. Toute écriture sur un dû
 * (encaissement, annulation) commence par ce verrou : deux opérations sur le même dû passent
 * l'une après l'autre et voient toujours le montant payé à jour.
 */
async function lockDue(tx: Tx, residenceId: string, dueId: string) {
  const [due] = await tx
    .select({
      id: schema.chargeDue.id,
      amountDue: schema.chargeDue.amountDue,
      amountPaid: schema.chargeDue.amountPaid,
    })
    .from(schema.chargeDue)
    .where(and(eq(schema.chargeDue.id, dueId), eq(schema.chargeDue.residenceId, residenceId)))
    .for('update');
  return due;
}

/** Recalcule le montant payé et le statut du dû à partir des paiements non annulés. */
async function recomputeDue(tx: Tx, residenceId: string, dueId: string, amountDue: number) {
  const [sum] = await tx
    .select({ paid: sql`coalesce(sum(${schema.payment.amount}), 0)`.mapWith(Number) })
    .from(schema.payment)
    .where(
      and(
        eq(schema.payment.chargeDueId, dueId),
        eq(schema.payment.residenceId, residenceId),
        isNull(schema.payment.cancelledAt),
      ),
    );
  const amountPaid = sum!.paid;
  const status = computeDueStatus(amountPaid, amountDue);
  await tx
    .update(schema.chargeDue)
    .set({ amountPaid, status })
    .where(and(eq(schema.chargeDue.id, dueId), eq(schema.chargeDue.residenceId, residenceId)));
  return { amountDue, amountPaid, remaining: amountDue - amountPaid, status };
}

/**
 * Encaisseurs (payments.write) : enregistre un paiement sur un dû de la résidence active.
 * Une seule transaction : verrou sur le dû, contrôle du reste (409 s'il est dépassé), paiement,
 * montant payé et statut du dû, puis reçu numéroté (« 2026-0042 », continu par résidence et par
 * année du paiement). Le PDF du reçu viendra à l'étape 3.
 */
payments.post('/', requireAuth, requireMembership, requirePermission('payments.write'), async (c) => {
  const input = await parseJson(c, createPaymentSchema);
  const residenceId = c.get('residenceId');
  const userId = c.get('user').id;

  const today = todayInCasablanca();
  const paidOn = input.paidOn ?? today;
  if (paidOn > today) return chargeRefusal(CHARGE_ERRORS.paymentDateInvalid);
  // Aujourd'hui : l'heure réelle. Date passée : midi UTC, le même jour à Casablanca.
  const paidAt = paidOn === today ? new Date() : new Date(`${paidOn}T12:00:00Z`);

  return withRefusals(async () => {
    const result = await db.transaction(async (tx) => {
      const due = await lockDue(tx, residenceId, input.chargeDueId);
      if (!due) throw new ChargeRefusal(CHARGE_ERRORS.notFound);
      if (input.amount > due.amountDue - due.amountPaid) {
        throw new ChargeRefusal(CHARGE_ERRORS.amountExceedsRemaining);
      }

      const [payment] = await tx
        .insert(schema.payment)
        .values({
          residenceId,
          chargeDueId: due.id,
          amount: input.amount,
          method: input.method,
          paidAt,
          recordedBy: userId,
        })
        .returning({
          id: schema.payment.id,
          amount: schema.payment.amount,
          method: schema.payment.method,
          paidAt: schema.payment.paidAt,
        });

      const amountPaid = due.amountPaid + input.amount;
      const status = computeDueStatus(amountPaid, due.amountDue);
      await tx
        .update(schema.chargeDue)
        .set({ amountPaid, status })
        .where(and(eq(schema.chargeDue.id, due.id), eq(schema.chargeDue.residenceId, residenceId)));

      const number = await nextReceiptNumber(tx, residenceId, Number(paidOn.slice(0, 4)));
      const [receipt] = await tx
        .insert(schema.receipt)
        .values({ residenceId, paymentId: payment!.id, number })
        .returning({ id: schema.receipt.id, number: schema.receipt.number });

      return {
        payment: { ...payment!, paidAt: payment!.paidAt.toISOString() },
        receipt: receipt!,
        due: {
          id: due.id,
          amountDue: due.amountDue,
          amountPaid,
          remaining: due.amountDue - amountPaid,
          status,
        },
      };
    });
    return c.json(result, 201);
  });
});

/**
 * Encaisseurs (payments.write) : annule un paiement, avec un motif obligatoire. Une seule
 * transaction avec verrous (dû, puis paiement, dans le même ordre que l'encaissement) :
 * annulation tracée (qui, quand, motif), puis montant payé et statut du dû recalculés.
 * Le paiement et son reçu sont conservés. 409 si déjà annulé.
 */
payments.post(
  '/:id/cancel',
  requireAuth,
  requireMembership,
  requirePermission('payments.write'),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) return chargeRefusal(CHARGE_ERRORS.notFound);
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = cancelPaymentSchema.safeParse(body);
    if (!parsed.success) return chargeRefusal(CHARGE_ERRORS.cancelReasonRequired);
    const residenceId = c.get('residenceId');
    const userId = c.get('user').id;

    const [found] = await db
      .select({ chargeDueId: schema.payment.chargeDueId })
      .from(schema.payment)
      .where(and(eq(schema.payment.id, id.data), eq(schema.payment.residenceId, residenceId)))
      .limit(1);
    if (!found) return chargeRefusal(CHARGE_ERRORS.notFound);

    return withRefusals(async () => {
      const result = await db.transaction(async (tx) => {
        const due = await lockDue(tx, residenceId, found.chargeDueId);
        if (!due) throw new ChargeRefusal(CHARGE_ERRORS.notFound);

        const [cancelled] = await tx
          .update(schema.payment)
          .set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: parsed.data.reason })
          .where(
            and(
              eq(schema.payment.id, id.data),
              eq(schema.payment.residenceId, residenceId),
              isNull(schema.payment.cancelledAt),
            ),
          )
          .returning({ id: schema.payment.id, cancelledAt: schema.payment.cancelledAt });
        if (!cancelled) throw new ChargeRefusal(CHARGE_ERRORS.alreadyCancelled);

        const recomputed = await recomputeDue(tx, residenceId, due.id, due.amountDue);
        return {
          payment: { id: cancelled.id, cancelledAt: cancelled.cancelledAt!.toISOString() },
          due: { id: due.id, ...recomputed },
        };
      });
      return c.json(result);
    });
  },
);
