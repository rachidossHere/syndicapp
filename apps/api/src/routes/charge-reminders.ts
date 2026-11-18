// Relance des impayés (plan 08, étape 4) : POST /api/charges/reminders.
// requireAuth, requireMembership puis requirePermission('charges.write') ; chaque requête filtre sur
// residence_id (la résidence vient de l'en-tête validé, jamais du corps).
//
// Une relance par lot au maximum tous les 3 jours, quel que soit l'appel de charges. Tout se passe
// dans UNE transaction : les lots visés sont verrouillés (`for update`, dans l'ordre des
// identifiants), la dernière relance est lue sous verrou, puis la relance est enregistrée et la
// notification (générique, copropriétaires du lot seulement) est ajoutée au même moment. Deux appels
// simultanés se suivent donc et le second voit la relance du premier.
import { db, schema } from '@syndic/db';
import {
  CHARGE_ERRORS,
  REMINDER_COOLDOWN_MS,
  createReminderSchema,
  nextReminderAt,
  type ReminderResult,
} from '@syndic/shared';
import { and, eq, inArray, max } from 'drizzle-orm';
import { Hono } from 'hono';

import { ChargeRefusal, CHARGE_ERROR_STATUS, chargeRefusal } from '../charge-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { notify } from '../notify';
import { parseJson } from '../validate';

export const chargeReminders = new Hono<MembershipEnv>();

/** Relance d'un seul lot trop tôt : porte la date de la prochaine relance possible. */
class ReminderTooSoon extends ChargeRefusal {
  constructor(readonly next: Date) {
    super(CHARGE_ERRORS.reminderTooSoon);
  }
}

const UNPAID_STATUSES = ['unpaid', 'partial'] as const;

chargeReminders.post(
  '/reminders',
  requireAuth,
  requireMembership,
  requirePermission('charges.write'),
  async (c) => {
    const input = await parseJson(c, createReminderSchema);
    const residenceId = c.get('residenceId');
    const userId = c.get('user').id;

    try {
      const result = await db.transaction(async (tx): Promise<ReminderResult> => {
        const due = schema.chargeDue;
        // Lots à relancer : ceux qui ont un dû impayé ou partiel.
        let lotIds: string[];
        if ('lotId' in input) {
          const [found] = await tx
            .select({ id: schema.lot.id })
            .from(schema.lot)
            .where(and(eq(schema.lot.id, input.lotId), eq(schema.lot.residenceId, residenceId)));
          if (!found) throw new ChargeRefusal(CHARGE_ERRORS.notFound);
          lotIds = [found.id];
        } else {
          if (input.chargeCallId) {
            const [call] = await tx
              .select({ id: schema.chargeCall.id })
              .from(schema.chargeCall)
              .where(
                and(
                  eq(schema.chargeCall.id, input.chargeCallId),
                  eq(schema.chargeCall.residenceId, residenceId),
                ),
              );
            if (!call) throw new ChargeRefusal(CHARGE_ERRORS.notFound);
          }
          const rows = await tx
            .selectDistinct({ lotId: due.lotId })
            .from(due)
            .where(
              and(
                eq(due.residenceId, residenceId),
                inArray(due.status, [...UNPAID_STATUSES]),
                input.chargeCallId ? eq(due.chargeCallId, input.chargeCallId) : undefined,
              ),
            );
          lotIds = rows.map((row) => row.lotId);
        }
        if (lotIds.length === 0) return { reminded: 0, skipped: 0, skippedLots: [] };
        lotIds.sort();

        // Verrou des lots, dans l'ordre des identifiants (pas d'interblocage entre deux appels).
        await tx
          .select({ id: schema.lot.id })
          .from(schema.lot)
          .where(and(eq(schema.lot.residenceId, residenceId), inArray(schema.lot.id, lotIds)))
          .orderBy(schema.lot.id)
          .for('update');

        // Sous verrou : parmi les lots visés, ceux qui ont toujours un dû impayé ou partiel.
        const stillDue = await tx
          .selectDistinct({ lotId: due.lotId })
          .from(due)
          .where(
            and(
              eq(due.residenceId, residenceId),
              inArray(due.lotId, lotIds),
              inArray(due.status, [...UNPAID_STATUSES]),
              'lotId' in input || !input.chargeCallId
                ? undefined
                : eq(due.chargeCallId, input.chargeCallId),
            ),
          );
        const dueLots = new Set(stillDue.map((row) => row.lotId));
        if ('lotId' in input && !dueLots.has(input.lotId)) {
          throw new ChargeRefusal(CHARGE_ERRORS.reminderNothingDue);
        }
        const targets = lotIds.filter((id) => dueLots.has(id));
        if (targets.length === 0) return { reminded: 0, skipped: 0, skippedLots: [] };

        const last = await tx
          .select({ lotId: schema.chargeReminder.lotId, at: max(schema.chargeReminder.createdAt) })
          .from(schema.chargeReminder)
          .where(
            and(
              eq(schema.chargeReminder.residenceId, residenceId),
              inArray(schema.chargeReminder.lotId, targets),
            ),
          )
          .groupBy(schema.chargeReminder.lotId);
        const lastByLot = new Map(last.map((row) => [row.lotId, row.at]));

        const now = new Date();
        const result: ReminderResult = { reminded: 0, skipped: 0, skippedLots: [] };
        const toRemind: string[] = [];
        for (const lotId of targets) {
          const at = lastByLot.get(lotId);
          if (at && now.getTime() - at.getTime() < REMINDER_COOLDOWN_MS) {
            if ('lotId' in input) throw new ReminderTooSoon(nextReminderAt(at));
            result.skipped += 1;
            result.skippedLots.push({ lotId, nextReminderAt: nextReminderAt(at).toISOString() });
          } else {
            toRemind.push(lotId);
          }
        }
        if (toRemind.length > 0) {
          await tx
            .insert(schema.chargeReminder)
            .values(
              toRemind.map((lotId) => ({ residenceId, lotId, sentBy: userId, createdAt: now })),
            );
          // Texte générique, copropriétaires du lot seulement (jamais le locataire).
          for (const lotId of toRemind) {
            await notify(residenceId, { kind: 'lot_owners', lotId }, 'charge_reminder', {}, tx);
          }
        }
        result.reminded = toRemind.length;
        return result;
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof ReminderTooSoon) {
        return Response.json(
          { error: error.key, nextReminderAt: error.next.toISOString() },
          { status: CHARGE_ERROR_STATUS[error.key] },
        );
      }
      if (error instanceof ChargeRefusal) return chargeRefusal(error.key);
      throw error;
    }
  },
);
