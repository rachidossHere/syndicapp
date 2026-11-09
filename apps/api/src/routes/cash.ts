// Caisse (plan 06, étape 2) : solde, encaissé et dépensé de la période en cours, journal paginé.
// Tout est calculé à la lecture ; la résidence vient du contexte. Aucun nom dans le journal.
import { db, schema } from '@syndic/db';
import { currentPeriodBounds, ledgerQuerySchema, periodLabelOf, todayInCasablanca } from '@syndic/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { getCashBalance, getLedger, getPeriodTotals } from '../services/cash';

export const cash = new Hono<MembershipEnv>();

cash.get('/', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const parsed = ledgerQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400);
  const { from, to, limit, offset } = parsed.data;
  const residenceId = c.get('residenceId');

  const [residence] = await db
    .select({
      chargePeriod: schema.residence.chargePeriod,
      openingBalance: schema.residence.openingBalance,
      openingBalanceDate: schema.residence.openingBalanceDate,
    })
    .from(schema.residence)
    .where(eq(schema.residence.id, residenceId))
    .limit(1);
  if (!residence) throw new HTTPException(403);

  const today = todayInCasablanca();
  const bounds = currentPeriodBounds(residence.chargePeriod, today);
  const [balance, totals, ledger] = await Promise.all([
    getCashBalance(residenceId),
    getPeriodTotals(residenceId, bounds),
    getLedger(residenceId, { from, to }, { limit, offset }),
  ]);

  return c.json({
    balance,
    openingBalance: residence.openingBalance,
    openingBalanceDate: residence.openingBalanceDate,
    period: { label: periodLabelOf(residence.chargePeriod, today), ...bounds, ...totals },
    ledger: { items: ledger.items, total: ledger.total, limit, offset },
  });
});
