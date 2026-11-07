// Numérotation des reçus : « 2026-0042 », continue et unique par résidence et par année.
// Appelé par POST /api/payments (plan 05, étape 2), dans la transaction de chaque encaissement.
import { sql } from 'drizzle-orm';

import type { Database } from './client';
import { receiptCounter } from './schema/charges';

/** Transaction Drizzle, ou la base elle-même. */
type Executor = Pick<Database, 'insert'>;

/** `(2026, 42)` → `2026-0042`. */
export function formatReceiptNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Réserve le prochain numéro de reçu de la résidence pour l'année donnée.
 *
 * À appeler **dans la transaction** qui crée le paiement et son reçu : l'UPSERT pose un verrou
 * sur la ligne du compteur jusqu'à la fin de la transaction, donc deux encaissements simultanés
 * sont sérialisés. Si la transaction échoue, le numéro n'est pas consommé (pas de trou).
 * `year` est l'année de la date du paiement (fuseau Africa/Casablanca), calculée par l'appelant.
 * Les reçus de paiements annulés sont conservés : leur numéro n'est jamais réutilisé.
 */
export async function nextReceiptNumber(
  tx: Executor,
  residenceId: string,
  year: number,
): Promise<string> {
  const [row] = await tx
    .insert(receiptCounter)
    .values({ residenceId, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [receiptCounter.residenceId, receiptCounter.year],
      set: { lastNumber: sql`${receiptCounter.lastNumber} + 1` },
    })
    .returning({ lastNumber: receiptCounter.lastNumber });
  return formatReceiptNumber(year, row!.lastNumber);
}
