import type { MyDue } from '@/hooks/use-charges';

/** Dû le plus récent de chaque appartement (l'API renvoie le plus récent en premier). */
export function currentDuePerLot(dues: readonly MyDue[]): MyDue[] {
  const seen = new Set<string>();
  const result: MyDue[] = [];
  for (const due of dues) {
    if (seen.has(due.lotReference)) continue;
    seen.add(due.lotReference);
    result.push(due);
  }
  return result;
}

/** Références de mes appartements, sans doublon, dans l'ordre de l'API : « A21 » ou « A12, A21 ». */
export const lotReferences = (dues: readonly MyDue[]): string =>
  [...new Set(dues.map((due) => due.lotReference))].join(', ');

/** Ce que la carte « Mes charges » affiche : montant restant à payer ; une fois réglé, le montant de l'appel. */
export function dueDisplay(due: Pick<MyDue, 'amountDue' | 'remaining' | 'status'>): {
  settled: boolean;
  amount: number;
  status: MyDue['status'];
} {
  const settled = due.remaining === 0;
  return { settled, amount: settled ? due.amountDue : due.remaining, status: due.status };
}

/** Dernier paiement non annulé d'un dû (un paiement annulé ne compte jamais), ou `undefined`. */
export const lastActivePayment = (due: Pick<MyDue, 'payments'>) =>
  due.payments.filter((payment) => payment.cancelledAt === null).at(-1);
