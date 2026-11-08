// Lectures communes aux routes des charges. Toujours filtrées sur la résidence active.
// Aucune colonne de personne (recorded_by, cancelled_by, nom, e-mail) n'est jamais sélectionnée.
import { db, schema } from '@syndic/db';
import { and, asc, eq, inArray } from 'drizzle-orm';

const naturalOrder = new Intl.Collator('fr', { numeric: true });
export const byReference = (a: string, b: string) => naturalOrder.compare(a, b);

export type DuePayment = {
  id: string;
  amount: number;
  method: 'cash' | 'transfer';
  paidAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
};

/** Paiements (avec numéro de reçu) des dus donnés, regroupés par dû. */
export async function paymentsByDue(
  residenceId: string,
  dueIds: string[],
): Promise<Map<string, DuePayment[]>> {
  const grouped = new Map<string, DuePayment[]>();
  if (dueIds.length === 0) return grouped;
  const rows = await db
    .select({
      id: schema.payment.id,
      chargeDueId: schema.payment.chargeDueId,
      amount: schema.payment.amount,
      method: schema.payment.method,
      paidAt: schema.payment.paidAt,
      cancelledAt: schema.payment.cancelledAt,
      cancelReason: schema.payment.cancelReason,
      receiptId: schema.receipt.id,
      receiptNumber: schema.receipt.number,
    })
    .from(schema.payment)
    .leftJoin(
      schema.receipt,
      and(
        eq(schema.receipt.paymentId, schema.payment.id),
        eq(schema.receipt.residenceId, residenceId),
      ),
    )
    .where(
      and(eq(schema.payment.residenceId, residenceId), inArray(schema.payment.chargeDueId, dueIds)),
    )
    .orderBy(asc(schema.payment.paidAt), asc(schema.payment.createdAt));

  for (const { chargeDueId, paidAt, cancelledAt, ...row } of rows) {
    const list = grouped.get(chargeDueId) ?? [];
    list.push({
      ...row,
      paidAt: paidAt.toISOString(),
      cancelledAt: cancelledAt?.toISOString() ?? null,
    });
    grouped.set(chargeDueId, list);
  }
  return grouped;
}
