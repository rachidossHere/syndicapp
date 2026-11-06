// Test d'intégration des contraintes du schéma résidences (plan 04).
// Utilise la base de DATABASE_URL (branche Neon dev en local, AGENTS.md). Toutes les données
// créées ici sont supprimées à la fin. Sans DATABASE_URL (CI sans base), il est ignoré.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../client';
import { user } from './auth';
import { invitation, lot, membership, residence } from './residence';

const envFile = resolve(import.meta.dirname, '../../../../.env.local');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Code Postgres de l'erreur, que Drizzle enveloppe dans `cause`. */
const pgCode = (error: unknown): string | undefined => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
};

const expectPgError = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, 'une erreur Postgres était attendue').toBeDefined();
  expect(pgCode(error)).toBe(code);
};

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

describe.skipIf(!hasDatabase)('schéma résidences (contraintes en base)', () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const userIds = [`${tag}-u1`, `${tag}-u2`];
  const residenceIds: string[] = [];

  const createResidence = async () => {
    const [row] = await getDb()
      .insert(residence)
      .values({ name: `Résidence ${tag}`, city: 'Casablanca' })
      .returning({ id: residence.id });
    residenceIds.push(row!.id);
    return row!.id;
  };

  beforeAll(async () => {
    await getDb()
      .insert(user)
      .values(userIds.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
  });

  afterAll(async () => {
    const db = getDb();
    if (residenceIds.length > 0) {
      await db.delete(invitation).where(inArray(invitation.residenceId, residenceIds));
      await db.delete(membership).where(inArray(membership.residenceId, residenceIds));
      await db.delete(lot).where(inArray(lot.residenceId, residenceIds));
      await db.delete(residence).where(inArray(residence.id, residenceIds));
    }
    await db.delete(user).where(inArray(user.id, userIds));
    await closeDb();
  });

  it('refuse deux managers actifs dans la même résidence', async () => {
    const residenceId = await createResidence();
    await getDb().insert(membership).values({ residenceId, userId: userIds[0]!, role: 'manager' });

    await expectPgError(
      getDb().insert(membership).values({ residenceId, userId: userIds[1]!, role: 'manager' }),
      UNIQUE_VIOLATION,
    );
  });

  it("accepte un second manager si l'un est inactif", async () => {
    const residenceId = await createResidence();
    const [first] = await getDb()
      .insert(membership)
      .values({ residenceId, userId: userIds[0]!, role: 'manager' })
      .returning({ id: membership.id });

    await getDb()
      .update(membership)
      .set({ active: false, endedAt: new Date() })
      .where(eq(membership.id, first!.id));

    await expect(
      getDb().insert(membership).values({ residenceId, userId: userIds[1]!, role: 'manager' }),
    ).resolves.toBeDefined();
  });

  it('accepte des managers actifs dans deux résidences différentes', async () => {
    const a = await createResidence();
    const b = await createResidence();
    await getDb()
      .insert(membership)
      .values({ residenceId: a, userId: userIds[0]!, role: 'manager' });
    await expect(
      getDb().insert(membership).values({ residenceId: b, userId: userIds[0]!, role: 'manager' }),
    ).resolves.toBeDefined();
  });

  it('refuse une référence de lot en double dans la même résidence', async () => {
    const residenceId = await createResidence();
    await getDb().insert(lot).values({ residenceId, reference: 'B12', building: 'B', floor: 1 });

    await expectPgError(
      getDb().insert(lot).values({ residenceId, reference: 'B12' }),
      UNIQUE_VIOLATION,
    );
  });

  it('accepte la même référence de lot dans une autre résidence', async () => {
    const a = await createResidence();
    const b = await createResidence();
    await getDb().insert(lot).values({ residenceId: a, reference: 'B12' });
    await expect(
      getDb().insert(lot).values({ residenceId: b, reference: 'B12' }),
    ).resolves.toBeDefined();
  });

  it("refuse un membre rattaché au lot d'une autre résidence", async () => {
    const a = await createResidence();
    const b = await createResidence();
    const [lotOfA] = await getDb()
      .insert(lot)
      .values({ residenceId: a, reference: 'A11' })
      .returning({ id: lot.id });

    await expectPgError(
      getDb()
        .insert(membership)
        .values({ residenceId: b, userId: userIds[0]!, role: 'owner', lotId: lotOfA!.id }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it('refuse un membership vers un utilisateur inexistant', async () => {
    const residenceId = await createResidence();
    await expectPgError(
      getDb()
        .insert(membership)
        .values({ residenceId, userId: `${tag}-absent`, role: 'owner' }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it('refuse une invitation au rôle manager', async () => {
    const residenceId = await createResidence();
    await expectPgError(
      getDb()
        .insert(invitation)
        .values({
          residenceId,
          role: 'manager',
          code: `${tag}-M`,
          expiresAt: new Date(Date.now() + 86_400_000),
          createdBy: userIds[0]!,
        }),
      CHECK_VIOLATION,
    );
  });
});
