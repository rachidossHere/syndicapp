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
