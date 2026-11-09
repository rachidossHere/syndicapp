// Test d'intégration des contraintes du schéma dépenses et solde de départ (plan 06, étape 1).
// Utilise la base de DATABASE_URL (branche Neon dev en local, AGENTS.md). Toutes les données
// créées ici sont supprimées à la fin. Sans DATABASE_URL (CI sans base), il est ignoré.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../client';
import { user } from './auth';
import { expense } from './expenses';
import { openingBalanceChange, residence } from './residence';

const envFile = resolve(import.meta.dirname, '../../../../.env.local');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const hasDatabase = Boolean(process.env.DATABASE_URL);

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
const CHECK_VIOLATION = '23514';
const RESTRICT_VIOLATION = '23001';

describe.skipIf(!hasDatabase)('schéma dépenses (contraintes en base)', () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const userId = `${tag}-u1`;
  const residenceIds: string[] = [];

  const createResidence = async () => {
    const [row] = await getDb()
      .insert(residence)
      .values({ name: `Résidence ${tag}`, city: 'Casablanca' })
      .returning({ id: residence.id });
    residenceIds.push(row!.id);
    return row!.id;
  };

  const base = (residenceId: string) => ({
    residenceId,
    label: 'Plombier · fuite parking',
    amount: 60_000,
    category: 'repairs' as const,
    spentOn: '2026-11-08',
    recordedBy: userId,
  });

  const invoice = {
    invoiceKey: 'a/b.jpg',
    invoiceContentType: 'image/jpeg',
  };

  beforeAll(async () => {
    await getDb()
      .insert(user)
      .values({ id: userId, name: userId, email: `${userId}@test.invalid` });
  });

  afterAll(async () => {
    const db = getDb();
    if (residenceIds.length > 0) {
      await db.delete(expense).where(inArray(expense.residenceId, residenceIds));
      await db
        .delete(openingBalanceChange)
        .where(inArray(openingBalanceChange.residenceId, residenceIds));
      await db.delete(residence).where(inArray(residence.id, residenceIds));
    }
    await db.delete(user).where(eq(user.id, userId));
    await closeDb();
  });

  it('crée une résidence avec un solde de départ à 0 et sans date', async () => {
    const id = await createResidence();
    const [row] = await getDb()
      .select({ b: residence.openingBalance, d: residence.openingBalanceDate })
      .from(residence)
      .where(eq(residence.id, id));
    expect(row).toEqual({ b: 0, d: null });
  });

  it('accepte une dépense valide, sans facture', async () => {
    const id = await createResidence();
    await expect(getDb().insert(expense).values(base(id))).resolves.toBeDefined();
  });

  it.each([0, -100])('refuse une dépense de montant %i', async (amount) => {
    const id = await createResidence();
    await expectPgError(getDb().insert(expense).values({ ...base(id), amount }), CHECK_VIOLATION);
  });

  it('refuse une annulation sans motif, ou avec un motif vide', async () => {
    const id = await createResidence();
    const cancelled = { cancelledAt: new Date(), cancelledBy: userId };
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(id), ...cancelled }),
      CHECK_VIOLATION,
    );
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(id), ...cancelled, cancelReason: '   ' }),
      CHECK_VIOLATION,
    );
    await expect(
      getDb()
        .insert(expense)
        .values({ ...base(id), ...cancelled, cancelReason: 'Doublon' }),
    ).resolves.toBeDefined();
  });

  it('refuse une annulation sans auteur', async () => {
    const id = await createResidence();
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(id), cancelledAt: new Date(), cancelReason: 'Erreur' }),
      CHECK_VIOLATION,
    );
  });

  it('refuse un client_id en double dans une résidence, et l’accepte dans une autre', async () => {
    const a = await createResidence();
    const b = await createResidence();
    const clientId = randomUUID();
    await getDb()
      .insert(expense)
      .values({ ...base(a), clientId });
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(a), clientId }),
      UNIQUE_VIOLATION,
    );
    await expect(
      getDb()
        .insert(expense)
        .values({ ...base(b), clientId }),
    ).resolves.toBeDefined();
    // Sans client_id, plusieurs dépenses restent permises.
    await getDb().insert(expense).values(base(a));
    await expect(getDb().insert(expense).values(base(a))).resolves.toBeDefined();
  });

  it('refuse une facture incohérente (type sans clé, taille nulle)', async () => {
    const id = await createResidence();
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(id), invoiceKey: 'a/b.jpg' }),
      CHECK_VIOLATION,
    );
    await expectPgError(
      getDb()
        .insert(expense)
        .values({ ...base(id), ...invoice, invoiceSize: 0 }),
      CHECK_VIOLATION,
    );
    await expect(
      getDb()
        .insert(expense)
        .values({ ...base(id), ...invoice, invoiceSize: 412_000 }),
    ).resolves.toBeDefined();
  });

  it('refuse de supprimer une résidence qui a des dépenses (pas de cascade)', async () => {
    const id = await createResidence();
    await getDb().insert(expense).values(base(id));
    await expectPgError(getDb().delete(residence).where(eq(residence.id, id)), RESTRICT_VIOLATION);
  });

  it('historique du solde : motif obligatoire sauf à la première saisie, une seule première saisie', async () => {
    const id = await createResidence();
    const change = { residenceId: id, asOfDate: '2026-10-01', changedBy: userId };
    const insert = (values: { oldAmount: number | null; newAmount: number; reason?: string }) =>
      getDb()
        .insert(openingBalanceChange)
        .values({ ...change, ...values });
    // Première saisie : ancien montant nul, pas de motif.
    await expect(insert({ oldAmount: null, newAmount: 540_000 })).resolves.toBeDefined();
    await expectPgError(insert({ oldAmount: null, newAmount: 1 }), UNIQUE_VIOLATION);
    // Correction : motif obligatoire.
    await expectPgError(insert({ oldAmount: 540_000, newAmount: 550_000 }), CHECK_VIOLATION);
    await expect(
      insert({ oldAmount: 540_000, newAmount: 550_000, reason: 'Oubli d’un reçu' }),
    ).resolves.toBeDefined();
  });
});
