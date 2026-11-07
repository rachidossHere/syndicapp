import { db, schema, sql } from '@syndic/db';
import { CHARGE_ERRORS, createChargeCallSchema, isPeriodLabelFor } from '@syndic/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { ChargeRefusal, chargeRefusal, isUniqueViolation, withRefusals } from '../charge-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { byReference, paymentsByDue } from '../services/charges';
import { parseJson } from '../validate';

export const chargeCalls = new Hono<MembershipEnv>();

/**
 * Syndic (charges.write) : lance un appel de charges et crée un dû par lot de la résidence, dans
 * une seule transaction. La ligne de la résidence est verrouillée : la périodicité ne peut pas
 * changer pendant la création. 409 si la période existe déjà (contrainte d'unicité en base).
 */
chargeCalls.post(
  '/',
  requireAuth,
  requireMembership,
  requirePermission('charges.write'),
  async (c) => {
    const input = await parseJson(c, createChargeCallSchema);
    const residenceId = c.get('residenceId');
    const userId = c.get('user').id;

    try {
      return await withRefusals(async () => {
        const created = await db.transaction(async (tx) => {
          const [residence] = await tx
            .select({ chargePeriod: schema.residence.chargePeriod })
            .from(schema.residence)
            .where(eq(schema.residence.id, residenceId))
            .for('update');
          if (!residence) throw new ChargeRefusal(CHARGE_ERRORS.notFound);
          if (!isPeriodLabelFor(residence.chargePeriod, input.periodLabel)) {
            throw new ChargeRefusal(CHARGE_ERRORS.periodMismatch);
          }

          const lots = await tx
            .select({ id: schema.lot.id })
            .from(schema.lot)
            .where(eq(schema.lot.residenceId, residenceId));
          if (lots.length === 0) throw new ChargeRefusal(CHARGE_ERRORS.noLots);

          const [call] = await tx
            .insert(schema.chargeCall)
            .values({
              residenceId,
              periodLabel: input.periodLabel,
              amountPerLot: input.amountPerLot,
              dueDate: input.dueDate,
              createdBy: userId,
            })
            .returning({
              id: schema.chargeCall.id,
              periodLabel: schema.chargeCall.periodLabel,
              amountPerLot: schema.chargeCall.amountPerLot,
              dueDate: schema.chargeCall.dueDate,
            });
          await tx.insert(schema.chargeDue).values(
            lots.map((lot) => ({
              residenceId,
              chargeCallId: call!.id,
              lotId: lot.id,
              amountDue: input.amountPerLot,
            })),
          );
          return { ...call!, lotCount: lots.length, totalDue: lots.length * input.amountPerLot };
        });
        return c.json(created, 201);
      });
    } catch (error) {
      if (isUniqueViolation(error)) return chargeRefusal(CHARGE_ERRORS.periodExists);
      throw error;
    }
  },
);

/** Lecture des comptes (accounts.read) : appels avec leurs totaux, sans détail par lot. */
chargeCalls.get('/', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const residenceId = c.get('residenceId');
  const due = schema.chargeDue;
  const statusCount = (status: 'paid' | 'partial' | 'unpaid') =>
    sql`count(${due.id}) filter (where ${due.status} = ${status})`.mapWith(Number);

  const rows = await db
    .select({
      id: schema.chargeCall.id,
      periodLabel: schema.chargeCall.periodLabel,
      amountPerLot: schema.chargeCall.amountPerLot,
      dueDate: schema.chargeCall.dueDate,
      lotCount: sql`count(${due.id})`.mapWith(Number),
      totalDue: sql`coalesce(sum(${due.amountDue}), 0)`.mapWith(Number),
      totalPaid: sql`coalesce(sum(${due.amountPaid}), 0)`.mapWith(Number),
      paidCount: statusCount('paid'),
      partialCount: statusCount('partial'),
      unpaidCount: statusCount('unpaid'),
    })
    .from(schema.chargeCall)
    .leftJoin(
      due,
      and(eq(due.chargeCallId, schema.chargeCall.id), eq(due.residenceId, residenceId)),
    )
    .where(eq(schema.chargeCall.residenceId, residenceId))
    .groupBy(schema.chargeCall.id)
    .orderBy(desc(schema.chargeCall.dueDate), desc(schema.chargeCall.createdAt));

  return c.json({
    chargeCalls: rows.map((row) => ({ ...row, remaining: row.totalDue - row.totalPaid })),
  });
});

/**
 * Encaisseurs (payments.write) : détail d'un appel, lot par lot (référence, dû, payé, statut,
 * paiements et numéros de reçu). Aucun nom de personne. Appel d'une autre résidence : 404.
 */
chargeCalls.get(
  '/:id',
  requireAuth,
  requireMembership,
  requirePermission('payments.write'),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) return chargeRefusal(CHARGE_ERRORS.notFound);
    const residenceId = c.get('residenceId');

    const [call] = await db
      .select({
        id: schema.chargeCall.id,
        periodLabel: schema.chargeCall.periodLabel,
        amountPerLot: schema.chargeCall.amountPerLot,
        dueDate: schema.chargeCall.dueDate,
      })
      .from(schema.chargeCall)
      .where(and(eq(schema.chargeCall.id, id.data), eq(schema.chargeCall.residenceId, residenceId)))
      .limit(1);
    if (!call) return chargeRefusal(CHARGE_ERRORS.notFound);

    const dues = await db
      .select({
        id: schema.chargeDue.id,
        lotId: schema.chargeDue.lotId,
        lotReference: schema.lot.reference,
        amountDue: schema.chargeDue.amountDue,
        amountPaid: schema.chargeDue.amountPaid,
        status: schema.chargeDue.status,
      })
      .from(schema.chargeDue)
      .innerJoin(
        schema.lot,
        and(eq(schema.lot.id, schema.chargeDue.lotId), eq(schema.lot.residenceId, residenceId)),
      )
      .where(
        and(eq(schema.chargeDue.chargeCallId, call.id), eq(schema.chargeDue.residenceId, residenceId)),
      );

    const payments = await paymentsByDue(
      residenceId,
      dues.map((d) => d.id),
    );
    return c.json({
      ...call,
      dues: dues
        .sort((a, b) => byReference(a.lotReference, b.lotReference))
        .map((d) => ({
          ...d,
          remaining: d.amountDue - d.amountPaid,
          payments: payments.get(d.id) ?? [],
        })),
    });
  },
);
