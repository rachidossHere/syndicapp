import { db, schema } from '@syndic/db';
import { createResidenceSchema } from '@syndic/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/require-auth';
import { requireMembership, type MembershipEnv } from '../middleware/require-membership';
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
    })
    .from(schema.residence)
    .where(eq(schema.residence.id, c.get('residenceId')));
  if (!row) return c.json({ error: 'forbidden' }, 403);
  return c.json({ ...row, role: c.get('role') });
});
