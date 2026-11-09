// Test d'intégration du solde et du journal de la caisse (plan 06, étape 1).
// Utilise la base de DATABASE_URL (branche Neon dev en local). Données supprimées à la fin.
// Sans DATABASE_URL (CI sans base), il est ignoré.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, db, schema } from '@syndic/db';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCashBalance, getLedger } from './cash';

const envFile = resolve(import.meta.dirname, '../../../../.env.local');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const hasDatabase = Boolean(process.env.DATABASE_URL);

const { residence, lot, chargeCall, chargeDue, payment, expense, user } = schema;

describe.skipIf(!hasDatabase)('caisse : solde et journal', () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const userId = `${tag}-u1`;
  const personName = `Karim Alaoui ${tag}`;
  const personEmail = `${userId}@test.invalid`;
  const residenceIds: string[] = [];
  let a = '';
  let b = '';
  let expenseIdsA: string[] = [];
  let expenseIdsB: string[] = [];
  let paymentIdsA: string[] = [];
  let paymentIdsB: string[] = [];

  const createResidence = async (openingBalance: number) => {
    const [row] = await db
      .insert(residence)
      .values({ name: `Résidence ${tag}`, city: 'Casablanca', openingBalance })
      .returning({ id: residence.id });
    residenceIds.push(row!.id);
    return row!.id;
  };

  /** Un lot, un appel et un dû, pour y rattacher des paiements. */
  const createDue = async (residenceId: string, reference: string) => {
    const [l] = await db.insert(lot).values({ residenceId, reference }).returning({ id: lot.id });
    const [c] = await db
      .insert(chargeCall)
      .values({
        residenceId,
        periodLabel: '2026-Q4',
        amountPerLot: 200_000,
        dueDate: '2026-12-15',
        createdBy: userId,
      })
      .returning({ id: chargeCall.id });
    const [d] = await db
      .insert(chargeDue)
      .values({ residenceId, chargeCallId: c!.id, lotId: l!.id, amountDue: 200_000 })
      .returning({ id: chargeDue.id });
    return d!.id;
  };

  const addPayment = async (
    residenceId: string,
    chargeDueId: string,
    amount: number,
    paidAt: string,
    cancelled = false,
  ) => {
    const [row] = await db
      .insert(payment)
      .values({
        residenceId,
        chargeDueId,
        amount,
        method: 'cash',
        paidAt: new Date(paidAt),
        recordedBy: userId,
        ...(cancelled
          ? { cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'Erreur' }
          : {}),
      })
      .returning({ id: payment.id });
    return row!.id;
  };

  const addExpense = async (
    residenceId: string,
    label: string,
    amount: number,
    spentOn: string,
    cancelled = false,
  ) => {
    const [row] = await db
      .insert(expense)
      .values({
        residenceId,
        label,
        amount,
        category: 'repairs',
        spentOn,
        recordedBy: userId,
        invoiceKey: label === 'D1' ? `${tag}/d1.jpg` : null,
        invoiceContentType: label === 'D1' ? 'image/jpeg' : null,
        ...(cancelled
          ? { cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'Doublon' }
          : {}),
      })
      .returning({ id: expense.id });
    return row!.id;
  };

  beforeAll(async () => {
    await db.insert(user).values({ id: userId, name: personName, email: personEmail });

    // Résidence A : solde de départ 1 000 MAD, 10 mouvements dont 2 annulés.
    a = await createResidence(100_000);
    const dueA = await createDue(a, 'B12');
    paymentIdsA = [
      await addPayment(a, dueA, 45_000, '2026-11-01T10:00:00Z'),
      await addPayment(a, dueA, 45_000, '2026-11-02T10:00:00Z', true), // annulé
      await addPayment(a, dueA, 30_000, '2026-11-03T10:00:00Z'),
      await addPayment(a, dueA, 20_000, '2026-11-04T10:00:00Z'),
    ];
    expenseIdsA = [
      await addExpense(a, 'D1', 60_000, '2026-11-05'),
      await addExpense(a, 'D2', 12_300, '2026-11-06', true), // annulée
      await addExpense(a, 'D3', 5_000, '2026-11-07'),
      await addExpense(a, 'D4', 18_000, '2026-11-08'),
      await addExpense(a, 'D5', 7_000, '2026-11-09'),
      await addExpense(a, 'D6', 25_000, '2026-11-09'),
    ];

    // Résidence B : ne doit jamais apparaître dans A.
    b = await createResidence(5_000);
    const dueB = await createDue(b, 'Z99');
    paymentIdsB = [await addPayment(b, dueB, 1_000, '2026-11-10T10:00:00Z')];
    expenseIdsB = [await addExpense(b, 'Secret de B', 300, '2026-11-10')];
  });

  afterAll(async () => {
    if (residenceIds.length > 0) {
      await db.delete(expense).where(inArray(expense.residenceId, residenceIds));
      await db.delete(payment).where(inArray(payment.residenceId, residenceIds));
      await db.delete(chargeDue).where(inArray(chargeDue.residenceId, residenceIds));
      await db.delete(chargeCall).where(inArray(chargeCall.residenceId, residenceIds));
      await db.delete(lot).where(inArray(lot.residenceId, residenceIds));
      await db.delete(residence).where(inArray(residence.id, residenceIds));
    }
    await db.delete(user).where(eq(user.id, userId));
    await closeDb();
  });

  it('calcule le solde exact sur 10 mouvements dont 2 annulés', async () => {
    // 100 000 + (45 000 + 30 000 + 20 000) − (60 000 + 5 000 + 18 000 + 7 000 + 25 000) = 80 000
    expect(await getCashBalance(a)).toBe(80_000);
  });

  it('ne compte pas un mouvement dès qu’il est annulé', async () => {
    const id = await addExpense(a, 'D7', 10_000, '2026-11-09');
    expect(await getCashBalance(a)).toBe(70_000);
    await db
      .update(expense)
      .set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'Erreur de saisie' })
      .where(eq(expense.id, id));
    expect(await getCashBalance(a)).toBe(80_000);
    await db.delete(expense).where(eq(expense.id, id));
  });

  it('refuse une résidence inconnue', async () => {
    await expect(getCashBalance('00000000-0000-4000-8000-000000000000')).rejects.toThrow();
  });

  it('liste les 10 mouvements, du plus récent au plus ancien, annulés inclus', async () => {
    const { items, total } = await getLedger(a, {}, { limit: 50, offset: 0 });
    expect(total).toBe(10);
    expect(items).toHaveLength(10);
    const dates = items.map((i) => i.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(items.filter((i) => i.cancelled)).toHaveLength(2);
    const cancelledExpense = items.find((i) => i.label === 'D2');
    expect(cancelledExpense).toMatchObject({
      cancelled: true,
      cancelReason: 'Doublon',
      direction: 'out',
    });
  });

  it('affiche « Charge reçue · B12 » pour un paiement', async () => {
    const { items } = await getLedger(a, {}, { limit: 50, offset: 0 });
    const payments = items.filter((i) => i.kind === 'payment');
    expect(payments).toHaveLength(4);
    for (const p of payments) {
      expect(p.label).toBe('Charge reçue · B12');
      expect(p.direction).toBe('in');
    }
    expect(items.find((i) => i.label === 'D1')?.hasInvoice).toBe(true);
  });

  it('ne contient aucun nom, e-mail ni identifiant d’utilisateur', async () => {
    const { items } = await getLedger(a, {}, { limit: 50, offset: 0 });
    const json = JSON.stringify(items);
    expect(json).not.toContain(personName);
    expect(json).not.toContain('Karim');
    expect(json).not.toContain(personEmail);
    expect(json).not.toContain(userId);
    expect(json).not.toContain('recorded');
    expect(json).not.toContain('cancelledBy');
  });

  it('pagine et filtre par période', async () => {
    const page1 = await getLedger(a, {}, { limit: 4, offset: 0 });
    const page2 = await getLedger(a, {}, { limit: 4, offset: 4 });
    const page3 = await getLedger(a, {}, { limit: 4, offset: 8 });
    expect([page1.items.length, page2.items.length, page3.items.length]).toEqual([4, 4, 2]);
    expect(page1.total).toBe(10);
    const ids = [...page1.items, ...page2.items, ...page3.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(10);

    const week = await getLedger(
      a,
      { from: '2026-11-05', to: '2026-11-07' },
      { limit: 50, offset: 0 },
    );
    expect(week.total).toBe(3);
    expect(week.items.map((i) => i.label).sort()).toEqual(['D1', 'D2', 'D3']);
  });

  it('isole les résidences : solde et journal sans rien d’une autre', async () => {
    expect(await getCashBalance(b)).toBe(5_700); // 5 000 + 1 000 − 300
    const ledgerA = await getLedger(a, {}, { limit: 50, offset: 0 });
    const ledgerB = await getLedger(b, {}, { limit: 50, offset: 0 });
    const idsA = new Set(ledgerA.items.map((i) => i.id));
    for (const id of [...paymentIdsB, ...expenseIdsB]) expect(idsA.has(id)).toBe(false);
    expect(JSON.stringify(ledgerA)).not.toContain('Z99');
    expect(JSON.stringify(ledgerA)).not.toContain('Secret de B');
    expect(ledgerB.total).toBe(2);
    const idsB = new Set(ledgerB.items.map((i) => i.id));
    for (const id of [...paymentIdsA, ...expenseIdsA]) expect(idsB.has(id)).toBe(false);
  });
});
