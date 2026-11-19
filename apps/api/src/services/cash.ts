// Caisse de la résidence (plan 06) : solde et journal des mouvements, toujours calculés,
// jamais stockés. Toutes les lectures sont filtrées sur la résidence. Aucune colonne de personne
// (recorded_by, cancelled_by, nom, e-mail) n'est sélectionnée : le journal ne montre que
// « Charge reçue · B12 ».
import { db, sql } from '@syndic/db';
import { formatPaymentLedgerLabel, TIMEZONE, type LedgerMonthSummary } from '@syndic/shared';

/**
 * Solde de la caisse en centimes :
 * solde de départ + paiements non annulés − dépenses non annulées.
 * Une seule requête : les trois valeurs viennent du même instantané de la base.
 */
export async function getCashBalance(residenceId: string): Promise<number> {
  const result = await db.execute<{ balance: string | null }>(sql`
    select (
      r.opening_balance
      + coalesce((select sum(p.amount) from payment p
                  where p.residence_id = r.id and p.cancelled_at is null), 0)
      - coalesce((select sum(e.amount) from expense e
                  where e.residence_id = r.id and e.cancelled_at is null), 0)
    )::bigint as balance
    from residence r
    where r.id = ${residenceId}
  `);
  const row = result.rows[0];
  if (!row || row.balance === null) throw new Error('residence_not_found');
  return Number(row.balance);
}

export type LedgerEntry = {
  kind: 'payment' | 'expense';
  id: string;
  /** Jour du mouvement (AAAA-MM-JJ, fuseau Africa/Casablanca). */
  date: string;
  direction: 'in' | 'out';
  /** Montant en centimes, toujours positif ; le sens est dans `direction`. */
  amount: number;
  /** « Charge reçue · B12 » pour un paiement, libellé saisi pour une dépense. */
  label: string;
  lotReference: string | null;
  category: string | null;
  hasInvoice: boolean;
  cancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type LedgerPeriod = { from?: string; to?: string };
export type LedgerPage = { limit: number; offset: number };

type LedgerRow = {
  kind: 'payment' | 'expense';
  id: string;
  date: string;
  amount: number;
  lot_reference: string | null;
  label: string | null;
  category: string | null;
  has_invoice: boolean;
  cancelled_at: Date | string | null;
  cancel_reason: string | null;
  total: string;
};

/**
 * Mouvements de la résidence (paiements et dépenses fusionnés), une ligne chacun, avec leur jour
 * (AAAA-MM-JJ, Africa/Casablanca). Base du journal et de ses résumés par mois : les deux voient
 * exactement les mêmes lignes. Aucune colonne de personne.
 */
const movements = (residenceId: string) => sql`
  select 'payment' as kind, p.id::text as id,
         to_char(p.paid_at at time zone ${TIMEZONE}, 'YYYY-MM-DD') as date,
         p.created_at, p.amount, l.reference as lot_reference,
         null::text as label, null::text as category, false as has_invoice,
         p.cancelled_at, p.cancel_reason
  from payment p
  join charge_due d on d.id = p.charge_due_id and d.residence_id = p.residence_id
  join lot l on l.id = d.lot_id and l.residence_id = d.residence_id
  where p.residence_id = ${residenceId}
  union all
  select 'expense', e.id::text, to_char(e.spent_on, 'YYYY-MM-DD'),
         e.created_at, e.amount, null, e.label, e.category::text,
         e.invoice_key is not null, e.cancelled_at, e.cancel_reason
  from expense e
  where e.residence_id = ${residenceId}
`;

/**
 * Résumé du journal par mois (AAAA-MM), du plus récent au plus ancien : nombre de mouvements (annulés
 * compris, comme le journal), encaissé et dépensé (mouvements non annulés seulement).
 */
export async function getLedgerMonths(residenceId: string): Promise<LedgerMonthSummary[]> {
  const result = await db.execute<{ month: string; count: string; collected: string; spent: string }>(sql`
    select left(m.date, 7) as month,
           count(*) as count,
           coalesce(sum(m.amount) filter (where m.kind = 'payment' and m.cancelled_at is null), 0) as collected,
           coalesce(sum(m.amount) filter (where m.kind = 'expense' and m.cancelled_at is null), 0) as spent
    from (${movements(residenceId)}) m
    group by left(m.date, 7)
    order by month desc
  `);
  return result.rows.map((row) => ({
    month: row.month,
    count: Number(row.count),
    collected: Number(row.collected),
    spent: Number(row.spent),
  }));
}

/**
 * Journal des mouvements (paiements et dépenses fusionnés), du plus récent au plus ancien.
 * `period` : bornes incluses (AAAA-MM-JJ). Les mouvements annulés restent listés (badge
 * « Annulée ») mais ne comptent pas dans le solde.
 */
export async function getLedger(
  residenceId: string,
  period: LedgerPeriod,
  page: LedgerPage,
): Promise<{ items: LedgerEntry[]; total: number }> {
  const from = period.from ?? null;
  const to = period.to ?? null;
  const result = await db.execute<LedgerRow>(sql`
    select m.*, count(*) over () as total
    from (${movements(residenceId)}) m
    where (${from}::text is null or m.date >= ${from}::text)
      and (${to}::text is null or m.date <= ${to}::text)
    order by m.date desc, m.created_at desc, m.id desc
    limit ${page.limit} offset ${page.offset}
  `);

  const items = result.rows.map((row): LedgerEntry => {
    const isPayment = row.kind === 'payment';
    const cancelledAt = row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null;
    return {
      kind: row.kind,
      id: row.id,
      date: row.date,
      direction: isPayment ? 'in' : 'out',
      amount: Number(row.amount),
      label: isPayment ? formatPaymentLedgerLabel(row.lot_reference ?? '') : (row.label ?? ''),
      lotReference: row.lot_reference,
      category: row.category,
      hasInvoice: row.has_invoice,
      cancelled: cancelledAt !== null,
      cancelledAt,
      cancelReason: row.cancel_reason,
    };
  });
  return { items, total: Number(result.rows[0]?.total ?? 0) };
}

/**
 * Encaissé et dépensé d'une période (bornes incluses, AAAA-MM-JJ), mouvements non annulés.
 * Les paiements sont rangés par jour de paiement à Casablanca, les dépenses par date de dépense.
 */
export async function getPeriodTotals(
  residenceId: string,
  period: { from: string; to: string },
): Promise<{ collected: number; spent: number }> {
  const result = await db.execute<{ collected: string; spent: string }>(sql`
    select
      coalesce((select sum(p.amount) from payment p
                where p.residence_id = ${residenceId} and p.cancelled_at is null
                  and to_char(p.paid_at at time zone ${TIMEZONE}, 'YYYY-MM-DD') between ${period.from} and ${period.to}), 0) as collected,
      coalesce((select sum(e.amount) from expense e
                where e.residence_id = ${residenceId} and e.cancelled_at is null
                  and to_char(e.spent_on, 'YYYY-MM-DD') between ${period.from} and ${period.to}), 0) as spent
  `);
  const row = result.rows[0];
  return { collected: Number(row?.collected ?? 0), spent: Number(row?.spent ?? 0) };
}
