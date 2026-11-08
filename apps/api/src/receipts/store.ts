// Génération et stockage des reçus PDF dans R2 (plan 05, étape 3).
// Toujours filtré sur la résidence. Ni la clé d'objet ni une URL signée n'est journalisée.
import { db, schema, sql } from '@syndic/db';
import { and, desc, eq } from 'drizzle-orm';

import { describeError, formatErrorSummary } from '../error-log';
import { getStorage } from '../storage/r2';
import { renderReceiptPdf, type ReceiptPdfData } from './pdf';

export const RECEIPT_CONTENT_TYPE = 'application/pdf';

/** residences/<residenceId>/receipts/<année>/<numéro>.pdf */
export const receiptStorageKey = (residenceId: string, number: string): string =>
  `residences/${residenceId}/receipts/${number.slice(0, 4)}/${number}.pdf`;

/** Nom de fichier proposé au téléchargement : recu-2026-0042.pdf */
export const receiptFilename = (number: string): string => `recu-${number}.pdf`;

export type ReceiptRecord = {
  id: string;
  number: string;
  storageKey: string | null;
  lotId: string;
  pdf: ReceiptPdfData;
};

/** Reçu de la résidence avec tout ce qu'il faut pour son PDF (aucun nom de personne). */
export async function loadReceipt(
  residenceId: string,
  receiptId: string,
): Promise<ReceiptRecord | undefined> {
  const [row] = await db
    .select({
      id: schema.receipt.id,
      number: schema.receipt.number,
      storageKey: schema.receipt.storageKey,
      lotId: schema.chargeDue.lotId,
      residenceName: schema.residence.name,
      lotReference: schema.lot.reference,
      periodLabel: schema.chargeCall.periodLabel,
      amount: schema.payment.amount,
      method: schema.payment.method,
      paidAt: schema.payment.paidAt,
      cancelledAt: schema.payment.cancelledAt,
      recordedBy: schema.payment.recordedBy,
    })
    .from(schema.receipt)
    .innerJoin(
      schema.payment,
      and(eq(schema.payment.id, schema.receipt.paymentId), eq(schema.payment.residenceId, residenceId)),
    )
    .innerJoin(
      schema.chargeDue,
      and(
        eq(schema.chargeDue.id, schema.payment.chargeDueId),
        eq(schema.chargeDue.residenceId, residenceId),
      ),
    )
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
    .innerJoin(schema.residence, eq(schema.residence.id, residenceId))
    .where(and(eq(schema.receipt.id, receiptId), eq(schema.receipt.residenceId, residenceId)))
    .limit(1);
  if (!row) return undefined;

  // Rôle de l'encaisseur dans la résidence (membership actif d'abord, sinon le plus récent).
  const [recorder] = await db
    .select({ role: schema.membership.role })
    .from(schema.membership)
    .where(
      and(
        eq(schema.membership.userId, row.recordedBy),
        eq(schema.membership.residenceId, residenceId),
      ),
    )
    .orderBy(desc(schema.membership.active), desc(schema.membership.createdAt))
    .limit(1);

  return {
    id: row.id,
    number: row.number,
    storageKey: row.storageKey,
    lotId: row.lotId,
    pdf: {
      number: row.number,
      residenceName: row.residenceName,
      lotReference: row.lotReference,
      periodLabel: row.periodLabel,
      amount: row.amount,
      method: row.method,
      paidAt: row.paidAt,
      recordedByRole: recorder?.role ?? null,
      cancelledAt: row.cancelledAt,
    },
  };
}

const MAX_ATTEMPTS = 3;

/**
 * Génère le PDF du reçu, l'envoie dans R2 et enregistre `storage_key`. Renvoie la clé.
 *
 * `storage_key` n'est enregistrée que si le paiement est toujours dans l'état rendu (payé ou
 * annulé) : si une annulation est passée pendant l'envoi, le PDF est régénéré, pour que le
 * fichier stocké ne montre jamais « Payé » pour un paiement annulé.
 */
export async function storeReceiptPdf(residenceId: string, receiptId: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const receipt = await loadReceipt(residenceId, receiptId);
    if (!receipt) throw new Error('receipt_not_found');
    const key = receiptStorageKey(residenceId, receipt.number);
    const bytes = await renderReceiptPdf(receipt.pdf);
    await getStorage().putObject(key, bytes, RECEIPT_CONTENT_TYPE);

    const renderedCancelled = receipt.pdf.cancelledAt !== null;
    const updated = await db
      .update(schema.receipt)
      .set({ storageKey: key })
      .where(
        and(
          eq(schema.receipt.id, receiptId),
          eq(schema.receipt.residenceId, residenceId),
          sql`exists (select 1 from ${schema.payment}
            where ${schema.payment.id} = ${schema.receipt.paymentId}
              and ${schema.payment.residenceId} = ${residenceId}
              and (${schema.payment.cancelledAt} is not null) = ${renderedCancelled})`,
        ),
      )
      .returning({ id: schema.receipt.id });
    if (updated.length > 0) return key;
  }
  throw new Error('receipt_state_changed');
}

/**
 * Comme `storeReceiptPdf`, sans jamais échouer : utilisé après un encaissement ou une annulation,
 * qui restent valides si R2 ne répond pas. `storage_key` reste vide et le PDF sera généré à la
 * première demande (GET /api/receipts/:id/url). Le journal ne contient que le nom et le code.
 */
export async function storeReceiptPdfSafely(residenceId: string, receiptId: string): Promise<void> {
  try {
    await storeReceiptPdf(residenceId, receiptId);
  } catch (error) {
    console.error(
      `[api] reçu ${receiptId} non stocké, généré à la première demande : ${formatErrorSummary(describeError(error))}`,
    );
  }
}
