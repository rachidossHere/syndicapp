import { db, schema, sql } from '@syndic/db';
import {
  CHARGE_ERRORS,
  NO_BUILDING_PARAM,
  can,
  chargeCallBuildingSummaryQuerySchema,
  chargeCallDetailQuerySchema,
  chargeCallListQuerySchema,
  chargeCallSummaryQuerySchema,
  createChargeCallSchema,
  isPeriodLabelFor,
  nextReminderAt,
  type ChargeCallYearSummary,
  type UnpaidBuildingSummary,
} from '@syndic/shared';
import { and, desc, eq, inArray, max, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { ChargeRefusal, chargeRefusal, isUniqueViolation, withRefusals } from '../charge-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { buildingKey, byReference, paymentsByDue } from '../services/charges';
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

/** Année d'un appel : les 4 premiers caractères de son libellé de période (« 2026-Q4 », « 2026-11 »). */
const callYear = sql<string>`substring(${schema.chargeCall.periodLabel} from 1 for 4)`;

/**
 * Lecture des comptes (accounts.read) : appels avec leurs totaux, sans détail par lot. `?year=2026`
 * ne garde que les appels de cette année (écran « Charges » en accordéons : une section par année).
 */
chargeCalls.get(
  '/',
  requireAuth,
  requireMembership,
  requirePermission('accounts.read'),
  async (c) => {
    const query = chargeCallListQuerySchema.safeParse(c.req.query());
    if (!query.success) throw new HTTPException(400);
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
      .where(
        and(
          eq(schema.chargeCall.residenceId, residenceId),
          query.data.year === undefined ? undefined : sql`${callYear} = ${query.data.year}`,
        ),
      )
      .groupBy(schema.chargeCall.id)
      .orderBy(desc(schema.chargeCall.dueDate), desc(schema.chargeCall.createdAt));

    return c.json({
      chargeCalls: rows.map((row) => ({ ...row, remaining: row.totalDue - row.totalPaid })),
    });
  },
);

/**
 * Résumé par année (accounts.read) : pour chaque année, le nombre d'appels, le dû, l'encaissé et le nombre
 * de dus qui ne sont pas soldés. Les mêmes totaux que la liste, sans charger un seul appel : c'est ce
 * qu'affiche chaque section fermée de l'écran « Charges ». Déclarée avant `/:id`.
 */
chargeCalls.get(
  '/summary',
  requireAuth,
  requireMembership,
  requirePermission('accounts.read'),
  async (c) => {
    if (!chargeCallSummaryQuerySchema.safeParse(c.req.query()).success) throw new HTTPException(400);
    const residenceId = c.get('residenceId');
    const due = schema.chargeDue;
    const rows = await db
      .select({
        year: callYear,
        callCount: sql`count(distinct ${schema.chargeCall.id})`.mapWith(Number),
        totalDue: sql`coalesce(sum(${due.amountDue}), 0)`.mapWith(Number),
        totalPaid: sql`coalesce(sum(${due.amountPaid}), 0)`.mapWith(Number),
        unpaidCount: sql`count(${due.id}) filter (where ${due.status} <> 'paid')`.mapWith(Number),
      })
      .from(schema.chargeCall)
      .leftJoin(
        due,
        and(eq(due.chargeCallId, schema.chargeCall.id), eq(due.residenceId, residenceId)),
      )
      .where(eq(schema.chargeCall.residenceId, residenceId))
      .groupBy(callYear)
      .orderBy(desc(callYear));
    const years: ChargeCallYearSummary[] = rows;
    return c.json({ years });
  },
);

/**
 * Impayés d'un appel, par bâtiment (payments.write) : pour chaque bâtiment, les lots impayés ou partiels
 * et le reste à payer ; pour le syndic seulement (charges.write), combien seraient relancés maintenant.
 * Aucun nom. Appel d'une autre résidence : 404. Les bâtiments sans impayé n'apparaissent pas.
 */
chargeCalls.get(
  '/:id/summary',
  requireAuth,
  requireMembership,
  requirePermission('payments.write'),
  async (c) => {
    if (!chargeCallBuildingSummaryQuerySchema.safeParse(c.req.query()).success) throw new HTTPException(400);
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) return chargeRefusal(CHARGE_ERRORS.notFound);
    const residenceId = c.get('residenceId');

    const [call] = await db
      .select({ id: schema.chargeCall.id, periodLabel: schema.chargeCall.periodLabel })
      .from(schema.chargeCall)
      .where(and(eq(schema.chargeCall.id, id.data), eq(schema.chargeCall.residenceId, residenceId)))
      .limit(1);
    if (!call) return chargeRefusal(CHARGE_ERRORS.notFound);

    const unpaid = await db
      .select({
        lotId: schema.chargeDue.lotId,
        building: buildingKey,
        amountDue: schema.chargeDue.amountDue,
        amountPaid: schema.chargeDue.amountPaid,
      })
      .from(schema.chargeDue)
      .innerJoin(
        schema.lot,
        and(eq(schema.lot.id, schema.chargeDue.lotId), eq(schema.lot.residenceId, residenceId)),
      )
      .where(
        and(
          eq(schema.chargeDue.chargeCallId, call.id),
          eq(schema.chargeDue.residenceId, residenceId),
          ne(schema.chargeDue.status, 'paid'),
        ),
      );

    // Lots relancés il y a moins de 3 jours : le syndic seulement, comme dans le détail de l'appel.
    const canSeeReminders = can(c.get('role'), 'charges.write');
    const cooling = new Set<string>();
    if (canSeeReminders && unpaid.length > 0) {
      const rows = await db
        .select({ lotId: schema.chargeReminder.lotId, at: max(schema.chargeReminder.createdAt) })
        .from(schema.chargeReminder)
        .where(
          and(
            eq(schema.chargeReminder.residenceId, residenceId),
            inArray(
              schema.chargeReminder.lotId,
              unpaid.map((d) => d.lotId),
            ),
          ),
        )
        .groupBy(schema.chargeReminder.lotId);
      const now = Date.now();
      for (const row of rows) {
        if (row.at && nextReminderAt(row.at).getTime() > now) cooling.add(row.lotId);
      }
    }

    const byBuilding = new Map<string | null, UnpaidBuildingSummary>();
    for (const row of unpaid) {
      const building = row.building ?? null;
      const entry: UnpaidBuildingSummary = byBuilding.get(building) ?? {
        building,
        unpaidCount: 0,
        remaining: 0,
        ...(canSeeReminders ? { remindableCount: 0 } : {}),
      };
      entry.unpaidCount += 1;
      entry.remaining += row.amountDue - row.amountPaid;
      if (canSeeReminders && !cooling.has(row.lotId)) entry.remindableCount = (entry.remindableCount ?? 0) + 1;
      byBuilding.set(building, entry);
    }
    const buildings = [...byBuilding.values()].sort((a, b) => {
      if (a.building === null) return 1;
      if (b.building === null) return -1;
      return byReference(a.building, b.building);
    });
    return c.json({ periodLabel: call.periodLabel, buildings });
  },
);

/**
 * Encaisseurs (payments.write) : détail d'un appel, lot par lot (référence, dû, payé, statut,
 * paiements et numéros de reçu). Aucun nom de personne. Appel d'une autre résidence : 404.
 * Pour charges.write seulement : date de la dernière relance de chaque lot et de la prochaine
 * possible (null tant que la limite de 3 jours est passée ou qu'il n'y a jamais eu de relance).
 */
chargeCalls.get(
  '/:id',
  requireAuth,
  requireMembership,
  requirePermission('payments.write'),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) return chargeRefusal(CHARGE_ERRORS.notFound);
    // `?building=A&unpaid=true` : les lots impayés ou partiels d'un bâtiment (`-` : sans bâtiment).
    const filter = chargeCallDetailQuerySchema.safeParse(c.req.query());
    if (!filter.success) throw new HTTPException(400);
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
        and(
          eq(schema.chargeDue.chargeCallId, call.id),
          eq(schema.chargeDue.residenceId, residenceId),
          filter.data.unpaid === 'true' ? ne(schema.chargeDue.status, 'paid') : undefined,
          filter.data.building === undefined
            ? undefined
            : filter.data.building === NO_BUILDING_PARAM
              ? sql`${buildingKey} is null`
              : sql`${buildingKey} = ${filter.data.building}`,
        ),
      );

    const payments = await paymentsByDue(
      residenceId,
      dues.map((d) => d.id),
    );

    const reminders = new Map<string, Date>();
    if (can(c.get('role'), 'charges.write') && dues.length > 0) {
      const rows = await db
        .select({ lotId: schema.chargeReminder.lotId, at: max(schema.chargeReminder.createdAt) })
        .from(schema.chargeReminder)
        .where(
          and(
            eq(schema.chargeReminder.residenceId, residenceId),
            inArray(
              schema.chargeReminder.lotId,
              dues.map((d) => d.lotId),
            ),
          ),
        )
        .groupBy(schema.chargeReminder.lotId);
      for (const row of rows) if (row.at) reminders.set(row.lotId, row.at);
    }
    const canSeeReminders = can(c.get('role'), 'charges.write');
    const now = Date.now();
    const reminderFields = (lotId: string) => {
      if (!canSeeReminders) return {};
      const last = reminders.get(lotId);
      const next = last ? nextReminderAt(last) : null;
      return {
        lastReminderAt: last?.toISOString() ?? null,
        nextReminderAt: next && next.getTime() > now ? next.toISOString() : null,
      };
    };
    return c.json({
      ...call,
      dues: dues
        .sort((a, b) => byReference(a.lotReference, b.lotReference))
        .map((d) => ({
          ...d,
          remaining: d.amountDue - d.amountPaid,
          payments: payments.get(d.id) ?? [],
          ...reminderFields(d.lotId),
        })),
    });
  },
);
