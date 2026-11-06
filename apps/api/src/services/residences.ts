import { db, schema } from '@syndic/db';
import type { CreateResidenceInput } from '@syndic/shared';

/**
 * Crée la résidence et le membership `manager` de son créateur dans une seule transaction :
 * si l'un des deux échoue, rien n'est créé.
 */
export async function createResidenceWithManager(userId: string, input: CreateResidenceInput) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.residence)
      .values({ name: input.name, city: input.city, address: input.address ?? null })
      .returning({
        id: schema.residence.id,
        name: schema.residence.name,
        city: schema.residence.city,
        address: schema.residence.address,
      });
    if (!created) throw new Error('residence_not_created');
    await tx.insert(schema.membership).values({ residenceId: created.id, userId, role: 'manager' });
    return created;
  });
}
