/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration de l'API des charges et des encaissements (plan 05, étape 2).
// Utilisent la base de DATABASE_URL (branche Neon dev en local, AGENTS.md) ; toutes les données
// créées sont supprimées à la fin. Sans DATABASE_URL (CI sans base), les tests sont ignorés.
// La session est simulée par l'en-tête x-test-user : tout le reste (middlewares, routes, base) est réel.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import {
  CHARGE_ERRORS,
  generateBulkLots,
  periodLabelOf,
  todayInCasablanca,
  type Role,
} from '@syndic/shared';
import { and, count, eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get('x-test-user');
        return id
          ? { user: { id, name: id, email: `${id}@test.invalid` }, session: { id: `s-${id}` } }
          : null;
      },
    },
    handler: async () => new Response(null, { status: 404 }),
  },
}));

const envFile = resolve(import.meta.dirname, '../../../.env.local');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const hasDatabase = Boolean(process.env.DATABASE_URL);

const MAD = 100; // centimes
const today = todayInCasablanca();
const year = today.slice(0, 4);
const currentQuarter = periodLabelOf('quarterly', today);
const currentMonth = periodLabelOf('monthly', today);

describe.skipIf(!hasDatabase)('API charges et encaissements', { timeout: 60_000 }, () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const userNames = [
    'mgrA',
    'treasurerA',
    'deputyA',
    'ownerA12',
    'ownerA21',
    'tenantA',
    'caretakerA',
    'mgrB',
    'ownerB',
  ];
  const users = userNames.map(uid);
  let app: (typeof import('./app'))['app'];
  let resA: string;
  let resB: string;
  let lotsA: Map<string, string>; // référence → id
  let lotsB: Map<string, string>;
  /** Corps de toutes les réponses, pour vérifier qu'aucune ne contient de nom ni d'e-mail. */
  const bodies: string[] = [];

  const api = async (
    userId: string | null,
    method: string,
    path: string,
    options: { residence?: string; body?: unknown } = {},
  ) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-test-user'] = userId;
    if (options.residence) headers['X-Residence-Id'] = options.residence;
    const response = await app.request(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    bodies.push(text);
    return { status: response.status, json: (text ? JSON.parse(text) : null) as any };
  };

  const addResidence = async (
    name: string,
    lots: { buildings: string[]; floorFrom: number; floorTo: number; perFloor: number },
  ) => {
    const db = getDb();
    const [row] = await db
      .insert(schema.residence)
      .values({ name: `${tag} ${name}`, city: 'Casablanca' })
      .returning({ id: schema.residence.id });
    const created = await db
      .insert(schema.lot)
      .values(generateBulkLots(lots).map((lot) => ({ ...lot, residenceId: row!.id })))
      .returning({ id: schema.lot.id, reference: schema.lot.reference });
    return { id: row!.id, lots: new Map(created.map((l) => [l.reference, l.id])) };
  };

  const addMembers = (residenceId: string, members: [string, Role, string?][]) =>
    getDb()
      .insert(schema.membership)
      .values(
        members.map(([name, role, lotId]) => ({
          residenceId,
          userId: uid(name),
          role,
          lotId: lotId ?? null,
        })),
      );

  /** Dû d'un lot pour un appel. */
  const dueOf = async (callId: string, lotId: string) => {
    const [row] = await getDb()
      .select({
        id: schema.chargeDue.id,
        amountPaid: schema.chargeDue.amountPaid,
        status: schema.chargeDue.status,
      })
      .from(schema.chargeDue)
      .where(and(eq(schema.chargeDue.chargeCallId, callId), eq(schema.chargeDue.lotId, lotId)));
    return row!;
  };

  /**
   * Appels, paiements et reçus des résidences de CE fichier (nom préfixé par `tag`).
   * Jamais un compte global : les autres fichiers de tests écrivent dans la même base dev en même
   * temps (receipts-api.test.ts, packages/db), et un compte global changeait sous nos pieds.
   */
  const counts = async () => {
    const db = getDb();
    const mine = db
      .select({ id: schema.residence.id })
      .from(schema.residence)
      .where(like(schema.residence.name, `${tag}%`));
    const n = async (table: typeof schema.payment | typeof schema.chargeCall | typeof schema.receipt) =>
      (await db.select({ n: count() }).from(table).where(inArray(table.residenceId, mine)))[0]!.n;
    return {
      payments: await n(schema.payment),
      calls: await n(schema.chargeCall),
      receipts: await n(schema.receipt),
    };
  };

  const receiptNumbers = async (residenceId: string) =>
    (
      await getDb()
        .select({ number: schema.receipt.number })
        .from(schema.receipt)
        .where(eq(schema.receipt.residenceId, residenceId))
    )
      .map((r) => r.number)
      .sort();

  /** Numéros attendus : `${year}-0001` à `${year}-000n`. */
  const expectContinuous = (numbers: string[]) => {
    expect(numbers).toEqual(
      numbers.map((_, i) => `${year}-${String(i + 1).padStart(4, '0')}`),
    );
  };

  let callA: string; // appel du trimestre en cours, 450 MAD sur 48 lots
  let callB: string;

  beforeAll(async () => {
    ({ app } = await import('./app'));
    // Stockage simulé : ces tests ne visent pas R2 (voir receipts-api.test.ts).
    const { setStorageForTests } = await import('./storage/r2');
    setStorageForTests({
      putObject: async () => undefined,
      getSignedReadUrl: async () => 'https://stockage.invalid/objet',
      deleteObject: async () => undefined,
    });
    await getDb()
      .insert(schema.user)
      .values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
    // A : bâtiments A et B, étages 1 à 4, 6 par étage = 48 lots (A11…A16, A21…, B46).
    const a = await addResidence('A', { buildings: ['A', 'B'], floorFrom: 1, floorTo: 4, perFloor: 6 });
    const b = await addResidence('B', { buildings: ['A'], floorFrom: 1, floorTo: 2, perFloor: 2 });
    [resA, lotsA, resB, lotsB] = [a.id, a.lots, b.id, b.lots];
    await addMembers(resA, [
      ['mgrA', 'manager'],
      ['treasurerA', 'treasurer'],
      ['deputyA', 'deputy'],
      ['ownerA12', 'owner', lotsA.get('A12')],
      ['ownerA21', 'owner', lotsA.get('A21')],
      ['tenantA', 'tenant', lotsA.get('A13')],
      ['caretakerA', 'caretaker'],
    ]);
    await addMembers(resB, [
      ['mgrB', 'manager'],
      ['ownerB', 'owner', lotsB.get('A12')],
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    const ids = (
      await db
        .select({ id: schema.residence.id })
        .from(schema.residence)
        .where(like(schema.residence.name, `${tag}%`))
    ).map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(schema.receipt).where(inArray(schema.receipt.residenceId, ids));
      await db.delete(schema.payment).where(inArray(schema.payment.residenceId, ids));
      await db.delete(schema.chargeDue).where(inArray(schema.chargeDue.residenceId, ids));
      await db.delete(schema.chargeCall).where(inArray(schema.chargeCall.residenceId, ids));
      await db.delete(schema.receiptCounter).where(inArray(schema.receiptCounter.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  describe('appels de charges', () => {
    it('450 MAD sur 48 lots : 48 dus, total 21 600 MAD', async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/charge-calls', {
        residence: resA,
        body: { periodLabel: currentQuarter, amountPerLot: 450 * MAD, dueDate: '2026-12-15' },
      });
      expect(response.status).toBe(201);
      expect(response.json).toMatchObject({
        periodLabel: currentQuarter,
        amountPerLot: 45_000,
        lotCount: 48,
        totalDue: 21_600 * MAD,
      });
      callA = response.json.id;

      const dues = await getDb()
        .select({ amountDue: schema.chargeDue.amountDue, status: schema.chargeDue.status })
        .from(schema.chargeDue)
        .where(eq(schema.chargeDue.chargeCallId, callA));
      expect(dues).toHaveLength(48);
      expect(dues.every((d) => d.amountDue === 45_000 && d.status === 'unpaid')).toBe(true);
    });

    it('deuxième appel sur la même période : 409 periodExists, rien de créé', async () => {
      const before = await counts();
      const response = await api(uid('mgrA'), 'POST', '/api/charge-calls', {
        residence: resA,
        body: { periodLabel: currentQuarter, amountPerLot: 500 * MAD, dueDate: '2026-12-31' },
      });
      // Diagnostic : en cas d'échec, le corps reçu est affiché.
      expect(response.status, JSON.stringify(response.json)).toBe(409);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.periodExists });
      expect((await counts()).calls, 'appels comptés').toBe(before.calls);
    });

    it('période au mauvais format pour la résidence : 400 periodMismatch', async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/charge-calls', {
        residence: resA,
        body: { periodLabel: currentMonth, amountPerLot: 450 * MAD, dueDate: '2026-12-15' },
      });
      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.periodMismatch });
    });

    it('montant nul, négatif ou à virgule, champ inconnu : 400', async () => {
      for (const body of [
        { periodLabel: '2027-Q1', amountPerLot: 0, dueDate: '2027-03-15' },
        { periodLabel: '2027-Q1', amountPerLot: -100, dueDate: '2027-03-15' },
        { periodLabel: '2027-Q1', amountPerLot: 450.5, dueDate: '2027-03-15' },
        { periodLabel: '2027-Q1', amountPerLot: 45_000, dueDate: '2027-03-15', residenceId: resB },
      ]) {
        const response = await api(uid('mgrA'), 'POST', '/api/charge-calls', { residence: resA, body });
        expect(response.status).toBe(400);
      }
    });

    it('GET /charge-calls : totaux sans détail par lot', async () => {
      const response = await api(uid('ownerA12'), 'GET', '/api/charge-calls', { residence: resA });
      expect(response.status).toBe(200);
      expect(response.json.chargeCalls).toEqual([
        {
          id: callA,
          periodLabel: currentQuarter,
          amountPerLot: 45_000,
          dueDate: '2026-12-15',
          lotCount: 48,
          totalDue: 2_160_000,
          totalPaid: 0,
          remaining: 2_160_000,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 48,
        },
      ]);
    });
  });

  describe('encaissements', () => {
    const pay = (lot: string, amount: number, user = 'mgrA', method = 'cash') =>
      dueOf(callA, lotsA.get(lot)!).then((due) =>
        api(uid(user), 'POST', '/api/payments', {
          residence: resA,
          body: { chargeDueId: due.id, amount, method },
        }),
      );

    it('450 MAD → paid, avec un reçu numéroté', async () => {
      const response = await pay('A11', 450 * MAD);
      expect(response.status).toBe(201);
      expect(response.json.due).toMatchObject({ amountPaid: 45_000, remaining: 0, status: 'paid' });
      expect(response.json.receipt.number).toBe(`${year}-0001`);
      expect(await dueOf(callA, lotsA.get('A11')!)).toMatchObject({ status: 'paid', amountPaid: 45_000 });
    });

    it('200 MAD → partial, puis 250 MAD → paid (le trésorier encaisse aussi)', async () => {
      const first = await pay('A13', 200 * MAD, 'treasurerA', 'transfer');
      expect(first.status).toBe(201);
      expect(first.json.due).toMatchObject({ amountPaid: 20_000, remaining: 25_000, status: 'partial' });
      const second = await pay('A13', 250 * MAD);
      expect(second.status).toBe(201);
      expect(second.json.due).toMatchObject({ amountPaid: 45_000, remaining: 0, status: 'paid' });
    });

    it('500 MAD sur un reste de 450 : 409 amountExceedsRemaining, rien d\'écrit', async () => {
      const before = await counts();
      const response = await pay('A14', 500 * MAD);
      expect(response.status).toBe(409);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.amountExceedsRemaining });
      expect(await dueOf(callA, lotsA.get('A14')!)).toMatchObject({ status: 'unpaid', amountPaid: 0 });
      expect(await counts()).toEqual(before);
    });

    it('dû déjà payé : tout nouvel encaissement est refusé', async () => {
      expect((await pay('A11', 1)).status).toBe(409);
    });

    it('date future : 400 ; date passée acceptée', async () => {
      const due = await dueOf(callA, lotsA.get('A15')!);
      const future = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: due.id, amount: 100, method: 'cash', paidOn: '2099-01-01' },
      });
      expect(future.status).toBe(400);
      expect(future.json).toEqual({ error: CHARGE_ERRORS.paymentDateInvalid });
      const past = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: due.id, amount: 100 * MAD, method: 'cash', paidOn: `${year}-01-02` },
      });
      expect(past.status).toBe(201);
      expect(past.json.payment.paidAt).toBe(`${year}-01-02T12:00:00.000Z`);
    });

    it('dû inconnu : 404', async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: randomUUID(), amount: 100, method: 'cash' },
      });
      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.notFound });
    });
  });

  describe('annulation', () => {
    let paymentIds: string[];

    beforeAll(async () => {
      const due = await dueOf(callA, lotsA.get('A16')!);
      paymentIds = [];
      for (const amount of [200 * MAD, 250 * MAD]) {
        const response = await api(uid('mgrA'), 'POST', '/api/payments', {
          residence: resA,
          body: { chargeDueId: due.id, amount, method: 'cash' },
        });
        paymentIds.push(response.json.payment.id);
      }
    });

    it('sans motif ou motif vide : 400 cancelReasonRequired', async () => {
      for (const body of [undefined, {}, { reason: '   ' }]) {
        const response = await api(uid('mgrA'), 'POST', `/api/payments/${paymentIds[1]}/cancel`, {
          residence: resA,
          body,
        });
        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: CHARGE_ERRORS.cancelReasonRequired });
      }
      expect(await dueOf(callA, lotsA.get('A16')!)).toMatchObject({ status: 'paid' });
    });

    it('annulation : statut et montants recalculés, paiement et reçu conservés', async () => {
      const first = await api(uid('treasurerA'), 'POST', `/api/payments/${paymentIds[1]}/cancel`, {
        residence: resA,
        body: { reason: 'Erreur de lot' },
      });
      expect(first.status).toBe(200);
      expect(first.json.due).toMatchObject({ amountPaid: 20_000, remaining: 25_000, status: 'partial' });

      const second = await api(uid('mgrA'), 'POST', `/api/payments/${paymentIds[0]}/cancel`, {
        residence: resA,
        body: { reason: 'Doublon' },
      });
      expect(second.json.due).toMatchObject({ amountPaid: 0, status: 'unpaid' });
      expect(await dueOf(callA, lotsA.get('A16')!)).toMatchObject({ status: 'unpaid', amountPaid: 0 });

      const kept = await getDb()
        .select({
          cancelledAt: schema.payment.cancelledAt,
          cancelledBy: schema.payment.cancelledBy,
          reason: schema.payment.cancelReason,
          receipt: schema.receipt.number,
        })
        .from(schema.payment)
        .innerJoin(schema.receipt, eq(schema.receipt.paymentId, schema.payment.id))
        .where(inArray(schema.payment.id, paymentIds));
      expect(kept).toHaveLength(2);
      expect(kept.every((p) => p.cancelledAt && p.receipt)).toBe(true);
      expect(kept.map((p) => p.cancelledBy).sort()).toEqual([uid('mgrA'), uid('treasurerA')]);
    });

    it('deuxième annulation : 409 alreadyCancelled', async () => {
      const response = await api(uid('mgrA'), 'POST', `/api/payments/${paymentIds[0]}/cancel`, {
        residence: resA,
        body: { reason: 'Encore' },
      });
      expect(response.status).toBe(409);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.alreadyCancelled });
    });

    it('après annulation, le lot peut de nouveau être encaissé', async () => {
      const due = await dueOf(callA, lotsA.get('A16')!);
      const response = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: due.id, amount: 450 * MAD, method: 'transfer' },
      });
      expect(response.status).toBe(201);
      expect(response.json.due.status).toBe('paid');
    });
  });

  describe('concurrence', () => {
    it('deux encaissements simultanés qui dépassent le reste : un seul réussit', async () => {
      const due = await dueOf(callA, lotsA.get('A22')!);
      const body = { chargeDueId: due.id, amount: 300 * MAD, method: 'cash' };
      const results = await Promise.all([
        api(uid('mgrA'), 'POST', '/api/payments', { residence: resA, body }),
        api(uid('treasurerA'), 'POST', '/api/payments', { residence: resA, body }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await dueOf(callA, lotsA.get('A22')!)).toMatchObject({
        status: 'partial',
        amountPaid: 30_000,
      });
    });

    it('dix encaissements simultanés sur le même dû : jamais plus que le dû', async () => {
      const due = await dueOf(callA, lotsA.get('A23')!);
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          api(uid('mgrA'), 'POST', '/api/payments', {
            residence: resA,
            body: { chargeDueId: due.id, amount: 100 * MAD, method: 'cash' },
          }),
        ),
      );
      // 450 MAD : 4 paiements de 100 passent, les 6 autres dépasseraient le reste.
      expect(results.filter((r) => r.status === 201)).toHaveLength(4);
      expect(results.filter((r) => r.status === 409)).toHaveLength(6);
      expect(await dueOf(callA, lotsA.get('A23')!)).toMatchObject({ amountPaid: 40_000, status: 'partial' });
    });

    it('numéros de reçu continus et uniques, même avec des encaissements simultanés', async () => {
      const refs = ['B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26'];
      const results = await Promise.all(
        refs.map(async (ref) => {
          const due = await dueOf(callA, lotsA.get(ref)!);
          return api(uid(ref.endsWith('1') ? 'treasurerA' : 'mgrA'), 'POST', '/api/payments', {
            residence: resA,
            body: { chargeDueId: due.id, amount: 450 * MAD, method: 'cash' },
          });
        }),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      const fromResponses = results.map((r) => r.json.receipt.number as string);
      expect(new Set(fromResponses).size).toBe(refs.length);

      const all = await receiptNumbers(resA);
      expectContinuous(all);
      expect(all).toEqual(expect.arrayContaining(fromResponses));
    });

    it('la numérotation est propre à chaque résidence', async () => {
      const call = await api(uid('mgrB'), 'POST', '/api/charge-calls', {
        residence: resB,
        body: { periodLabel: currentQuarter, amountPerLot: 300 * MAD, dueDate: '2026-12-15' },
      });
      expect(call.status).toBe(201);
      callB = call.json.id;
      const due = await dueOf(callB, lotsB.get('A11')!);
      const response = await api(uid('mgrB'), 'POST', '/api/payments', {
        residence: resB,
        body: { chargeDueId: due.id, amount: 300 * MAD, method: 'cash' },
      });
      expect(response.json.receipt.number).toBe(`${year}-0001`);
    });
  });

  describe('détail d\'un appel', () => {
    it('lot par lot : référence, dû, payé, statut, paiements et reçus', async () => {
      const response = await api(uid('treasurerA'), 'GET', `/api/charge-calls/${callA}`, {
        residence: resA,
      });
      expect(response.status).toBe(200);
      const { dues } = response.json;
      expect(dues).toHaveLength(48);
      expect(dues[0].lotReference).toBe('A11');
      const a13 = dues.find((d: any) => d.lotReference === 'A13');
      expect(a13).toMatchObject({ amountDue: 45_000, amountPaid: 45_000, remaining: 0, status: 'paid' });
      expect(a13.payments).toHaveLength(2);
      expect(a13.payments[0]).toMatchObject({ amount: 20_000, method: 'transfer', cancelledAt: null });
      expect(a13.payments[0].receiptNumber).toMatch(/^\d{4}-\d{4}$/);
      const a16 = dues.find((d: any) => d.lotReference === 'A16');
      expect(a16.payments.filter((p: any) => p.cancelledAt)).toHaveLength(2);
    });

    it('les totaux de la liste suivent les encaissements', async () => {
      const response = await api(uid('mgrA'), 'GET', '/api/charge-calls', { residence: resA });
      const [call] = response.json.chargeCalls;
      const dues = await getDb()
        .select({ paid: schema.chargeDue.amountPaid, status: schema.chargeDue.status })
        .from(schema.chargeDue)
        .where(eq(schema.chargeDue.chargeCallId, callA));
      const totalPaid = dues.reduce((sum, d) => sum + d.paid, 0);
      expect(call).toMatchObject({
        totalPaid,
        remaining: 2_160_000 - totalPaid,
        paidCount: dues.filter((d) => d.status === 'paid').length,
        partialCount: dues.filter((d) => d.status === 'partial').length,
        unpaidCount: dues.filter((d) => d.status === 'unpaid').length,
      });
      expect(call.paidCount + call.partialCount + call.unpaidCount).toBe(48);
    });

    it('identifiant inconnu ou invalide : 404', async () => {
      for (const id of [randomUUID(), 'pas-un-uuid']) {
        const response = await api(uid('mgrA'), 'GET', `/api/charge-calls/${id}`, { residence: resA });
        expect(response.status).toBe(404);
      }
    });
  });

  describe('mes charges', () => {
    it('le copropriétaire de A12 ne voit que les dus de A12', async () => {
      const due = await dueOf(callA, lotsA.get('A12')!);
      await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: due.id, amount: 450 * MAD, method: 'cash' },
      });
      const response = await api(uid('ownerA12'), 'GET', '/api/me/dues', { residence: resA });
      expect(response.status).toBe(200);
      expect(response.json.dues).toHaveLength(1);
      const [mine] = response.json.dues;
      expect(mine).toMatchObject({ lotReference: 'A12', status: 'paid', periodLabel: currentQuarter });
      expect(mine.payments).toHaveLength(1);
      expect(mine.payments[0].receiptNumber).toMatch(new RegExp(`^${year}-\\d{4}$`));
      expect(mine.payments[0]).not.toHaveProperty('cancelReason');
    });

    it('le copropriétaire de A21 ne voit que A21, toujours impayé', async () => {
      const response = await api(uid('ownerA21'), 'GET', '/api/me/dues', { residence: resA });
      expect(response.json.dues.map((d: any) => d.lotReference)).toEqual(['A21']);
      expect(response.json.dues[0]).toMatchObject({ status: 'unpaid', payments: [] });
    });

    it('le syndic sans lot reçoit une liste vide', async () => {
      const response = await api(uid('mgrA'), 'GET', '/api/me/dues', { residence: resA });
      expect(response.json).toEqual({ dues: [] });
    });

    it('le copropriétaire de B ne voit que sa résidence', async () => {
      const response = await api(uid('ownerB'), 'GET', '/api/me/dues', { residence: resB });
      expect(response.json.dues).toHaveLength(1);
      expect(response.json.dues[0].chargeCallId).toBe(callB);
    });
  });

  describe('permissions par rôle', () => {
    type Check = [string, string, (r: string) => unknown, Role[]];
    const routes = (): Check[] => [
      ['POST', '/api/charge-calls', () => ({ periodLabel: '2030-Q1', amountPerLot: 100, dueDate: '2030-03-01' }), ['manager']],
      ['GET', '/api/charge-calls', () => undefined, ['manager', 'treasurer', 'deputy', 'owner']],
      ['GET', `/api/charge-calls/${callA}`, () => undefined, ['manager', 'treasurer']],
      ['POST', '/api/payments', () => ({ chargeDueId: randomUUID(), amount: 100, method: 'cash' }), ['manager', 'treasurer']],
      ['POST', `/api/payments/${randomUUID()}/cancel`, () => ({ reason: 'test' }), ['manager', 'treasurer']],
      ['GET', '/api/me/dues', () => undefined, ['manager', 'treasurer', 'deputy', 'owner']],
      ['PATCH', '/api/residences/current', () => ({ chargePeriod: 'quarterly' }), ['manager']],
    ];
    const members: [string, Role][] = [
      ['mgrA', 'manager'],
      ['treasurerA', 'treasurer'],
      ['deputyA', 'deputy'],
      ['ownerA12', 'owner'],
      ['tenantA', 'tenant'],
      ['caretakerA', 'caretaker'],
    ];

    it('chaque route n\'est ouverte qu\'aux rôles prévus', async () => {
      const before = await counts();
      for (const [method, path, body, allowed] of routes()) {
        for (const [name, role] of members) {
          // Seules les écritures sans effet sont tentées par les rôles autorisés (404 ou 409 attendus).
          if (allowed.includes(role) && method === 'POST' && path === '/api/charge-calls') continue;
          const response = await api(uid(name), method, path, { residence: resA, body: body(resA) });
          if (allowed.includes(role)) {
            expect(response.status, `${role} ${method} ${path}`).not.toBe(403);
          } else {
            expect(response.status, `${role} ${method} ${path}`).toBe(403);
            expect(response.json).toEqual({ error: 'forbidden' });
          }
        }
      }
      expect(await counts()).toEqual(before);
    });

    it('tenant et caretaker n\'ont accès à aucune route de charges', async () => {
      for (const name of ['tenantA', 'caretakerA']) {
        for (const [method, path, body] of routes()) {
          const response = await api(uid(name), method, path, { residence: resA, body: body(resA) });
          expect(response.status, `${name} ${method} ${path}`).toBe(403);
        }
      }
    });

    it('401 sans session', async () => {
      for (const [method, path, body] of routes()) {
        expect((await api(null, method, path, { residence: resA, body: body(resA) })).status).toBe(401);
      }
    });
  });

  describe('isolation entre résidences', () => {
    it('chaque route : un membre de A ne peut rien lire ni écrire dans B (403)', async () => {
      const before = await counts();
      const dueB = await dueOf(callB, lotsB.get('A12')!);
      const checks: [string, string, unknown?][] = [
        ['POST', '/api/charge-calls', { periodLabel: '2030-Q2', amountPerLot: 100, dueDate: '2030-06-01' }],
        ['GET', '/api/charge-calls'],
        ['GET', `/api/charge-calls/${callB}`],
        ['POST', '/api/payments', { chargeDueId: dueB.id, amount: 100, method: 'cash' }],
        ['POST', `/api/payments/${randomUUID()}/cancel`, { reason: 'x' }],
        ['GET', '/api/me/dues'],
        ['PATCH', '/api/residences/current', { chargePeriod: 'monthly' }],
      ];
      for (const [method, path, body] of checks) {
        for (const name of ['mgrA', 'treasurerA', 'ownerA12']) {
          const response = await api(uid(name), method, path, { residence: resB, body });
          expect(response.status, `${name} ${method} ${path}`).toBe(403);
        }
      }
      expect(await counts()).toEqual(before);
      expect(await dueOf(callB, lotsB.get('A12')!)).toMatchObject({ status: 'unpaid', amountPaid: 0 });
    });

    it('les identifiants de B, utilisés depuis A, sont introuvables (404) et rien ne bouge', async () => {
      const before = await counts();
      const dueB = await dueOf(callB, lotsB.get('A12')!);
      const [paymentB] = await getDb()
        .select({ id: schema.payment.id })
        .from(schema.payment)
        .where(eq(schema.payment.residenceId, resB));

      const detail = await api(uid('mgrA'), 'GET', `/api/charge-calls/${callB}`, { residence: resA });
      const payment = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: dueB.id, amount: 100, method: 'cash' },
      });
      const cancel = await api(uid('mgrA'), 'POST', `/api/payments/${paymentB!.id}/cancel`, {
        residence: resA,
        body: { reason: 'intrusion' },
      });
      for (const response of [detail, payment, cancel]) {
        expect(response.status).toBe(404);
        expect(response.json).toEqual({ error: CHARGE_ERRORS.notFound });
      }
      expect(await counts()).toEqual(before);
      const [stillValid] = await getDb()
        .select({ cancelledAt: schema.payment.cancelledAt })
        .from(schema.payment)
        .where(eq(schema.payment.id, paymentB!.id));
      expect(stillValid!.cancelledAt).toBeNull();
    });

    it('les listes de A ne contiennent rien de B', async () => {
      const list = await api(uid('mgrA'), 'GET', '/api/charge-calls', { residence: resA });
      expect(list.json.chargeCalls.map((c: any) => c.id)).toEqual([callA]);
      const listB = await api(uid('mgrB'), 'GET', '/api/charge-calls', { residence: resB });
      expect(listB.json.chargeCalls.map((c: any) => c.id)).toEqual([callB]);
    });

    it('la résidence vient de l\'en-tête, jamais du corps (champ inconnu : 400)', async () => {
      const due = await dueOf(callA, lotsA.get('A24')!);
      const response = await api(uid('mgrA'), 'POST', '/api/payments', {
        residence: resA,
        body: { chargeDueId: due.id, amount: 100, method: 'cash', residenceId: resB },
      });
      expect(response.status).toBe(400);
    });
  });

  describe('réglage de la périodicité', () => {
    it('refusé (409) si un appel existe pour la période en cours', async () => {
      const response = await api(uid('mgrA'), 'PATCH', '/api/residences/current', {
        residence: resA,
        body: { chargePeriod: 'monthly' },
      });
      expect(response.status).toBe(409);
      expect(response.json).toEqual({ error: CHARGE_ERRORS.periodLocked });
    });

    it('sans appel en cours : changement accepté, puis le format mensuel est exigé', async () => {
      const resC = await addResidence('C', { buildings: ['C'], floorFrom: 1, floorTo: 1, perFloor: 2 });
      await addMembers(resC.id, [['mgrB', 'manager']]);
      const same = await api(uid('mgrB'), 'PATCH', '/api/residences/current', {
        residence: resC.id,
        body: { chargePeriod: 'quarterly' },
      });
      expect(same.json).toEqual({ id: resC.id, chargePeriod: 'quarterly' });

      const changed = await api(uid('mgrB'), 'PATCH', '/api/residences/current', {
        residence: resC.id,
        body: { chargePeriod: 'monthly' },
      });
      expect(changed.status).toBe(200);
      expect(changed.json).toEqual({ id: resC.id, chargePeriod: 'monthly' });
      const current = await api(uid('mgrB'), 'GET', '/api/residences/current', { residence: resC.id });
      expect(current.json.chargePeriod).toBe('monthly');

      const quarterly = await api(uid('mgrB'), 'POST', '/api/charge-calls', {
        residence: resC.id,
        body: { periodLabel: currentQuarter, amountPerLot: 100, dueDate: '2026-12-15' },
      });
      expect(quarterly.status).toBe(400);
      const monthly = await api(uid('mgrB'), 'POST', '/api/charge-calls', {
        residence: resC.id,
        body: { periodLabel: currentMonth, amountPerLot: 100, dueDate: '2026-12-15' },
      });
      expect(monthly.status).toBe(201);
      expect(monthly.json.lotCount).toBe(2);

      const back = await api(uid('mgrB'), 'PATCH', '/api/residences/current', {
        residence: resC.id,
        body: { chargePeriod: 'quarterly' },
      });
      expect(back.status).toBe(409);
    });

    it('valeur invalide : 400', async () => {
      const response = await api(uid('mgrA'), 'PATCH', '/api/residences/current', {
        residence: resA,
        body: { chargePeriod: 'yearly' },
      });
      expect(response.status).toBe(400);
    });
  });

  describe('données personnelles', () => {
    it('aucune réponse ne contient de nom, d\'e-mail ni d\'identifiant d\'utilisateur', () => {
      expect(bodies.length).toBeGreaterThan(50);
      // Nom = identifiant (`${tag}-mgrA`…), e-mail = identifiant + `@test.invalid`.
      const leaks = bodies.filter(
        (body) => users.some((id) => body.includes(id)) || body.includes('@test.invalid'),
      );
      expect(leaks).toEqual([]);
    });
  });
});
