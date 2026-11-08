import { db, schema } from '@syndic/db';
import { CHARGE_ERRORS, can } from '@syndic/shared';
import { and, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { chargeRefusal } from '../charge-errors';
import { requireAuth } from '../middleware/require-auth';
import { requireMembership, type MembershipEnv } from '../middleware/require-membership';
import {
  RECEIPT_CONTENT_TYPE,
  loadReceipt,
  receiptFilename,
  storeReceiptPdf,
  type ReceiptRecord,
} from '../receipts/store';
import { SIGNED_URL_TTL_SECONDS, getStorage } from '../storage/r2';

export const receipts = new Hono<MembershipEnv>();

/**
 * Reçu de la résidence active, si l'utilisateur y a accès ; sinon la réponse de refus.
 * Accès : rôle avec payments.write (syndic, trésorier), ou copropriétaire actif du lot concerné.
 * Tout autre rôle, ou le copropriétaire d'un autre lot : 403. Reçu d'une autre résidence :
 * introuvable (404), car la recherche est filtrée sur la résidence de l'en-tête.
 */
async function authorizedReceipt(c: Context<MembershipEnv>): Promise<ReceiptRecord | Response> {
  const role = c.get('role');
  const isCollector = can(role, 'payments.write');
  if (!isCollector && role !== 'owner') throw new HTTPException(403);

  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return chargeRefusal(CHARGE_ERRORS.notFound);
  const residenceId = c.get('residenceId');

  const receipt = await loadReceipt(residenceId, id.data);
  if (!receipt) return chargeRefusal(CHARGE_ERRORS.notFound);

  if (!isCollector) {
    // Copropriétaire : uniquement le lot de son membership actif dans cette résidence.
    const [mine] = await db
      .select({ id: schema.membership.id })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.id, c.get('membershipId')),
          eq(schema.membership.residenceId, residenceId),
          eq(schema.membership.role, 'owner'),
          eq(schema.membership.active, true),
          eq(schema.membership.lotId, receipt.lotId),
        ),
      )
      .limit(1);
    if (!mine) throw new HTTPException(403);
  }
  return receipt;
}

/**
 * Détail d'un reçu (écran 6 de docs/charges.png) : numéro, résidence, appartement, période,
 * montant, mode, date, rôle de l'encaisseur (jamais son nom) et annulation éventuelle.
 */
receipts.get('/:id', requireAuth, requireMembership, async (c) => {
  const receipt = await authorizedReceipt(c);
  if (receipt instanceof Response) return receipt;
  const { pdf } = receipt;
  return c.json({
    id: receipt.id,
    number: receipt.number,
    residenceName: pdf.residenceName,
    lotReference: pdf.lotReference,
    periodLabel: pdf.periodLabel,
    amount: pdf.amount,
    method: pdf.method,
    paidAt: pdf.paidAt.toISOString(),
    recordedByRole: pdf.recordedByRole,
    cancelledAt: pdf.cancelledAt?.toISOString() ?? null,
  });
});

/**
 * URL signée (5 minutes) du reçu PDF, mêmes règles d'accès que le détail.
 * Si le PDF n'a pas encore été stocké (échec d'envoi à l'encaissement), il est généré ici.
 * L'URL n'est jamais journalisée.
 */
receipts.get('/:id/url', requireAuth, requireMembership, async (c) => {
  const receipt = await authorizedReceipt(c);
  if (receipt instanceof Response) return receipt;
  const residenceId = c.get('residenceId');

  const key = receipt.storageKey ?? (await storeReceiptPdf(residenceId, receipt.id));
  const filename = receiptFilename(receipt.number);
  const url = await getStorage().getSignedReadUrl(key, {
    filename,
    contentType: RECEIPT_CONTENT_TYPE,
  });
  c.header('Cache-Control', 'no-store');
  return c.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, filename });
});
