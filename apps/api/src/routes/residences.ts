import { db, schema } from '@syndic/db';
import {
  CHARGE_ERRORS,
  CHARGE_PERIODS,
  createResidenceSchema,
  EXPENSE_ERRORS,
  setOpeningBalanceSchema,
  periodLabelOf,
  todayInCasablanca,
  updateResidenceSettingsSchema,
} from '@syndic/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';

import { ChargeRefusal, withRefusals } from '../charge-errors';
import { expenseRefusal } from '../expense-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { createResidenceWithManager } from '../services/residences';
import { parseJson } from '../validate';

export const residences = new Hono<MembershipEnv>();

/** Crée une résidence dont l'utilisateur devient le syndic. Pas de X-Residence-Id. */
residences.post('/', requireAuth, async (c) => {
  const input = await parseJson(c, createResidenceSchema);
  const created = await createResidenceWithManager(c.get('user').id, input);
  return c.json({ ...created, role: 'manager' }, 201);
});

/** Mes résidences actives avec mon rôle dans chacune (filtré sur mon utilisateur). */
residences.get('/', requireAuth, async (c) => {
  const rows = await db
    .select({
      id: schema.residence.id,
      name: schema.residence.name,
      city: schema.residence.city,
      address: schema.residence.address,
      role: schema.membership.role,
    })
    .from(schema.membership)
    .innerJoin(schema.residence, eq(schema.residence.id, schema.membership.residenceId))
    .where(and(eq(schema.membership.userId, c.get('user').id), eq(schema.membership.active, true)))
    .orderBy(schema.residence.name);
  return c.json({ residences: rows });
});

/** Résidence de X-Residence-Id et mon rôle. Déclarée avant toute route à paramètre. */
residences.get('/current', requireAuth, requireMembership, async (c) => {
  const [row] = await db
    .select({
      id: schema.residence.id,
      name: schema.residence.name,
      city: schema.residence.city,
      address: schema.residence.address,
      chargePeriod: schema.residence.chargePeriod,
    })
    .from(schema.residence)
    .where(eq(schema.residence.id, c.get('residenceId')));
  if (!row) return c.json({ error: 'forbidden' }, 403);
  return c.json({ ...row, role: c.get('role') });
});

/**
 * Syndic (residence.manage) : réglage de la périodicité des charges. Refusé (409) si un appel de
 * charges existe déjà pour la période en cours (trimestre ou mois d'aujourd'hui, à Casablanca).
 * La ligne de la résidence est verrouillée, comme à la création d'un appel.
 */
residences.patch(
  '/current',
  requireAuth,
  requireMembership,
  requirePermission('residence.manage'),
  async (c) => {
    const input = await parseJson(c, updateResidenceSettingsSchema);
    const residenceId = c.get('residenceId');
    const today = todayInCasablanca();
    const currentLabels = CHARGE_PERIODS.map((period) => periodLabelOf(period, today));

    return withRefusals(async () => {
      const chargePeriod = await db.transaction(async (tx) => {
        const [current] = await tx
          .select({ chargePeriod: schema.residence.chargePeriod })
          .from(schema.residence)
          .where(eq(schema.residence.id, residenceId))
          .for('update');
        if (!current) throw new ChargeRefusal(CHARGE_ERRORS.notFound);
        if (current.chargePeriod === input.chargePeriod) return current.chargePeriod;

        const [existing] = await tx
          .select({ id: schema.chargeCall.id })
          .from(schema.chargeCall)
          .where(
            and(
              eq(schema.chargeCall.residenceId, residenceId),
              inArray(schema.chargeCall.periodLabel, currentLabels),
            ),
          )
          .limit(1);
        if (existing) throw new ChargeRefusal(CHARGE_ERRORS.periodLocked);

        await tx
          .update(schema.residence)
          .set({ chargePeriod: input.chargePeriod })
          .where(eq(schema.residence.id, residenceId));
        return input.chargePeriod;
      });
      return c.json({ id: residenceId, chargePeriod });
    });
  },
);

/**
 * Syndic (residence.manage) : solde de départ de la caisse. Première saisie : sans motif. Toute
 * correction exige un motif (400). Résidence et historique (ancien et nouveau montant, qui, quand,
 * motif) sont écrits dans une seule transaction, la ligne de la résidence étant verrouillée.
 */
residences.put(
  '/current/opening-balance',
  requireAuth,
  requireMembership,
  requirePermission('residence.manage'),
  async (c) => {
    const input = await parseJson(c, setOpeningBalanceSchema);
    const residenceId = c.get('residenceId');
    const userId = c.get('user').id;

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ openingBalance: schema.residence.openingBalance })
        .from(schema.residence)
        .where(eq(schema.residence.id, residenceId))
        .for('update');
      if (!current) return null;
      const [previous] = await tx
        .select({ id: schema.openingBalanceChange.id })
        .from(schema.openingBalanceChange)
        .where(eq(schema.openingBalanceChange.residenceId, residenceId))
        .limit(1);
      if (previous && !input.reason) return 'reason_required' as const;

      await tx
        .update(schema.residence)
        .set({ openingBalance: input.amount, openingBalanceDate: input.asOfDate })
        .where(eq(schema.residence.id, residenceId));
      await tx.insert(schema.openingBalanceChange).values({
        residenceId,
        oldAmount: previous ? current.openingBalance : null,
        newAmount: input.amount,
        asOfDate: input.asOfDate,
        reason: previous ? input.reason : (input.reason ?? null),
        changedBy: userId,
      });
      return { openingBalance: input.amount, openingBalanceDate: input.asOfDate, corrected: Boolean(previous) };
    });
    if (result === null) return c.json({ error: 'forbidden' }, 403);
    if (result === 'reason_required') return expenseRefusal(EXPENSE_ERRORS.openingReasonRequired);
    return c.json(result);
  },
);
