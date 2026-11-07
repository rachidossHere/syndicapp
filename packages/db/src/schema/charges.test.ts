// Test d'intégration des contraintes du schéma charges, paiements et reçus (plan 05, étape 1).
// Utilise la base de DATABASE_URL (branche Neon dev en local, AGENTS.md). Toutes les données
// créées ici sont supprimées à la fin. Sans DATABASE_URL (CI sans base), il est ignoré.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../client';
import { nextReceiptNumber } from '../receipt-number';
import { user } from './auth';
import {
  chargeCall,
  chargeDue,
  payment,
  receipt,
  receiptCounter,
} from './charges';
import { lot, residence } from './residence';

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
/** Suppression refusée par une clé étrangère `ON DELETE RESTRICT`. */
const RESTRICT_VIOLATION = '23001';

describe.skipIf(!hasDatabase)('schéma charges (contraintes en base)', () => {
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

  const createLot = async (residenceId: string, reference = 'B12') => {
    const [row] = await getDb()
      .insert(lot)
      .values({ residenceId, reference })
      .returning({ id: lot.id });
    return row!.id;
  };

  const createCall = async (residenceId: string, periodLabel = '2026-Q4') => {
    const [row] = await getDb()
      .insert(chargeCall)
      .values({ residenceId, periodLabel, amountPerLot: 45_000, dueDate: '2026-12-15', createdBy: userId })
      .returning({ id: chargeCall.id });
    return row!.id;
  };

  /** Résidence avec un lot, un appel et un dû de 450 MAD. */
  const createDue = async () => {
    const residenceId = await createResidence();
    const lotId = await createLot(residenceId);
    const chargeCallId = await createCall(residenceId);
    const [due] = await getDb()
      .insert(chargeDue)
      .values({ residenceId, chargeCallId, lotId, amountDue: 45_000 })
      .returning({ id: chargeDue.id });
    return { residenceId, lotId, chargeCallId, dueId: due!.id };
  };

  const createPayment = async (residenceId: string, chargeDueId: string) => {
    const [row] = await getDb()
      .insert(payment)
      .values({ residenceId, chargeDueId, amount: 45_000, method: 'cash', recordedBy: userId })
      .returning({ id: payment.id });
    return row!.id;
  };

  beforeAll(async () => {
    await getDb()
      .insert(user)
      .values({ id: userId, name: userId, email: `${userId}@test.invalid` });
  });

  afterAll(async () => {
    const db = getDb();
    if (residenceIds.length > 0) {
      // Ordre inverse des dépendances : les clés étrangères sont en `restrict`.
      await db.delete(receipt).where(inArray(receipt.residenceId, residenceIds));
      await db.delete(payment).where(inArray(payment.residenceId, residenceIds));
      await db.delete(chargeDue).where(inArray(chargeDue.residenceId, residenceIds));
      await db.delete(chargeCall).where(inArray(chargeCall.residenceId, residenceIds));
      await db.delete(receiptCounter).where(inArray(receiptCounter.residenceId, residenceIds));
      await db.delete(lot).where(inArray(lot.residenceId, residenceIds));
      await db.delete(residence).where(inArray(residence.id, residenceIds));
    }
    await db.delete(user).where(eq(user.id, userId));
    await closeDb();
  });

  it('crée une résidence trimestrielle par défaut', async () => {
    const residenceId = await createResidence();
    const [row] = await getDb()
      .select({ chargePeriod: residence.chargePeriod })
      .from(residence)
      .where(eq(residence.id, residenceId));
    expect(row!.chargePeriod).toBe('quarterly');
  });

  it('refuse deux appels pour la même période dans une résidence, accepte une autre résidence', async () => {
    const a = await createResidence();
    const b = await createResidence();
    await createCall(a);
    await expectPgError(createCall(a), UNIQUE_VIOLATION);
    await expect(createCall(b)).resolves.toBeDefined();
  });

  it('refuse un montant par lot nul ou négatif', async () => {
    const residenceId = await createResidence();
    for (const [i, amountPerLot] of [0, -100].entries()) {
      await expectPgError(
        getDb()
          .insert(chargeCall)
          .values({ residenceId, periodLabel: `2026-Q${i + 1}`, amountPerLot, dueDate: '2026-12-15', createdBy: userId }),
        CHECK_VIOLATION,
      );
    }
  });

  it('refuse un second dû pour le même lot et le même appel', async () => {
    const { residenceId, lotId, chargeCallId } = await createDue();
    await expectPgError(
      getDb().insert(chargeDue).values({ residenceId, chargeCallId, lotId, amountDue: 45_000 }),
      UNIQUE_VIOLATION,
    );
  });

  it('refuse un dû nul ou négatif', async () => {
    const residenceId = await createResidence();
    const lotId = await createLot(residenceId);
    const chargeCallId = await createCall(residenceId);
    for (const amountDue of [0, -45_000]) {
      await expectPgError(
        getDb().insert(chargeDue).values({ residenceId, chargeCallId, lotId, amountDue }),
        CHECK_VIOLATION,
      );
    }
  });

  it('refuse amount_paid supérieur à amount_due ou négatif', async () => {
    const { dueId } = await createDue();
    await expectPgError(
      getDb().update(chargeDue).set({ amountPaid: 45_001, status: 'paid' }).where(eq(chargeDue.id, dueId)),
      CHECK_VIOLATION,
    );
    await expectPgError(
      getDb().update(chargeDue).set({ amountPaid: -1 }).where(eq(chargeDue.id, dueId)),
      CHECK_VIOLATION,
    );
  });

  it('refuse un statut incohérent avec les montants, accepte partial puis paid', async () => {
    const { dueId } = await createDue();
    await expectPgError(
      getDb().update(chargeDue).set({ amountPaid: 20_000 }).where(eq(chargeDue.id, dueId)),
      CHECK_VIOLATION,
    );
    await expect(
      getDb().update(chargeDue).set({ amountPaid: 20_000, status: 'partial' }).where(eq(chargeDue.id, dueId)),
    ).resolves.toBeDefined();
    await expect(
      getDb().update(chargeDue).set({ amountPaid: 45_000, status: 'paid' }).where(eq(chargeDue.id, dueId)),
    ).resolves.toBeDefined();
  });

  it("refuse un dû rattaché au lot d'une autre résidence", async () => {
    const a = await createResidence();
    const b = await createResidence();
    const lotOfA = await createLot(a);
    const callOfB = await createCall(b);
    await expectPgError(
      getDb()
        .insert(chargeDue)
        .values({ residenceId: b, chargeCallId: callOfB, lotId: lotOfA, amountDue: 45_000 }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it("refuse un dû rattaché à l'appel d'une autre résidence", async () => {
    const a = await createResidence();
    const b = await createResidence();
    const lotOfB = await createLot(b);
    const callOfA = await createCall(a);
    await expectPgError(
      getDb()
        .insert(chargeDue)
        .values({ residenceId: b, chargeCallId: callOfA, lotId: lotOfB, amountDue: 45_000 }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it("refuse un paiement nul, négatif, ou vers le dû d'une autre résidence", async () => {
    const { residenceId, dueId } = await createDue();
    const other = await createResidence();
    for (const amount of [0, -1]) {
      await expectPgError(
        getDb()
          .insert(payment)
          .values({ residenceId, chargeDueId: dueId, amount, method: 'cash', recordedBy: userId }),
        CHECK_VIOLATION,
      );
    }
    await expectPgError(
      getDb()
        .insert(payment)
        .values({ residenceId: other, chargeDueId: dueId, amount: 100, method: 'cash', recordedBy: userId }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it('refuse un paiement annulé sans motif (absent, vide ou espaces)', async () => {
    const { residenceId, dueId } = await createDue();
    const paymentId = await createPayment(residenceId, dueId);
    for (const cancelReason of [null, '', '   ']) {
      await expectPgError(
        getDb()
          .update(payment)
          .set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason })
          .where(eq(payment.id, paymentId)),
        CHECK_VIOLATION,
      );
    }
    await expectPgError(
      getDb()
        .update(payment)
        .set({ cancelledAt: new Date(), cancelReason: 'Erreur de lot' })
        .where(eq(payment.id, paymentId)),
      CHECK_VIOLATION,
    );
  });

  it('accepte un paiement annulé avec motif', async () => {
    const { residenceId, dueId } = await createDue();
    const paymentId = await createPayment(residenceId, dueId);
    await expect(
      getDb()
        .update(payment)
        .set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'Erreur de lot' })
        .where(eq(payment.id, paymentId)),
    ).resolves.toBeDefined();
  });

  it('refuse de supprimer un dû qui a un paiement (pas de suppression physique)', async () => {
    const { residenceId, dueId } = await createDue();
    await createPayment(residenceId, dueId);
    await expectPgError(
      getDb().delete(chargeDue).where(eq(chargeDue.id, dueId)),
      RESTRICT_VIOLATION,
    );
  });

  it('refuse un numéro de reçu en double dans une résidence, accepte dans une autre', async () => {
    const a = await createDue();
    const b = await createDue();
    const paymentA1 = await createPayment(a.residenceId, a.dueId);
    const paymentA2 = await createPayment(a.residenceId, a.dueId);
    const paymentB = await createPayment(b.residenceId, b.dueId);

    await getDb()
      .insert(receipt)
      .values({ residenceId: a.residenceId, paymentId: paymentA1, number: '2026-0042' });
    await expectPgError(
      getDb()
        .insert(receipt)
        .values({ residenceId: a.residenceId, paymentId: paymentA2, number: '2026-0042' }),
      UNIQUE_VIOLATION,
    );
    await expect(
      getDb()
        .insert(receipt)
        .values({ residenceId: b.residenceId, paymentId: paymentB, number: '2026-0042' }),
    ).resolves.toBeDefined();
  });

  it('refuse deux reçus pour un même paiement et un numéro mal formé', async () => {
    const { residenceId, dueId } = await createDue();
    const paymentId = await createPayment(residenceId, dueId);
    await expectPgError(
      getDb().insert(receipt).values({ residenceId, paymentId, number: '42' }),
      CHECK_VIOLATION,
    );
    await getDb().insert(receipt).values({ residenceId, paymentId, number: '2026-0001' });
    await expectPgError(
      getDb().insert(receipt).values({ residenceId, paymentId, number: '2026-0002' }),
      UNIQUE_VIOLATION,
    );
  });

  it("refuse un reçu rattaché au paiement d'une autre résidence", async () => {
    const a = await createDue();
    const b = await createResidence();
    const paymentOfA = await createPayment(a.residenceId, a.dueId);
    await expectPgError(
      getDb().insert(receipt).values({ residenceId: b, paymentId: paymentOfA, number: '2026-0001' }),
      FOREIGN_KEY_VIOLATION,
    );
  });

  it('numérote les reçus sans doublon, même en simultané, et par résidence et par année', async () => {
    const a = await createResidence();
    const b = await createResidence();
    const db = getDb();

    const numbers = await Promise.all(
      Array.from({ length: 8 }, () =>
        db.transaction((tx) => nextReceiptNumber(tx, a, 2026)),
      ),
    );
    expect([...numbers].sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `2026-${String(i + 1).padStart(4, '0')}`),
    );

    // Autre année et autre résidence : chacune repart de 1.
    await expect(db.transaction((tx) => nextReceiptNumber(tx, a, 2027))).resolves.toBe('2027-0001');
    await expect(db.transaction((tx) => nextReceiptNumber(tx, b, 2026))).resolves.toBe('2026-0001');
  });

  it("ne consomme pas de numéro si la transaction est annulée", async () => {
    const a = await createResidence();
    const db = getDb();
    await expect(
      db.transaction(async (tx) => {
        await nextReceiptNumber(tx, a, 2026);
        throw new Error('rollback voulu');
      }),
    ).rejects.toThrow('rollback voulu');
    await expect(db.transaction((tx) => nextReceiptNumber(tx, a, 2026))).resolves.toBe('2026-0001');
  });
});
