import { db, schema } from '@syndic/db';
import {
  CHARGE_ERRORS,
  CHARGE_PERIODS,
  createResidenceSchema,
  periodLabelOf,
  todayInCasablanca,
  updateResidenceSettingsSchema,
} from '@syndic/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';

import { ChargeRefusal, withRefusals } from '../charge-errors';
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
