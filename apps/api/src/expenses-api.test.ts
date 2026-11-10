/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration de l'API des dépenses, des factures et de la caisse (plan 06, étape 2) :
// base de DATABASE_URL (branche Neon dev) et bucket R2 des variables R2_* (syndicapp-dev).
// Toutes les données et tous les fichiers créés sont supprimés à la fin. Sans base ou sans R2,
// les tests sont ignorés. La session est simulée par l'en-tête x-test-user : tout le reste
// (routes, base, R2) est réel.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import {
  EXPENSE_ERRORS,
  periodLabelOf,
  todayInCasablanca,
  type Role,
} from '@syndic/shared';
import { and, eq, inArray, like } from 'drizzle-orm';
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
if (existsSync(envFile)) process.loadEnvFile(envFile);
const configured =
  Boolean(process.env.DATABASE_URL) &&
  ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].every(
    (name) => process.env[name],
  );

const MAD = 100;
const today = todayInCasablanca();
// PNG 1×1 valide (70 octets environ) : une vraie image pour l'envoi réel vers R2.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe.skipIf(!configured)('API des dépenses et de la caisse', { timeout: 120_000 }, () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const names = [
    'mgrA',
    'treasurerA',
    'deputyA',
    'ownerA11',
    'tenantA11',
    'caretakerA',
    'mgrB',
    'ownerB',
  ];
  const users = names.map(uid);
  let app: (typeof import('./app'))['app'];
  let r2: typeof import('./storage/r2');
  let resA: string;
  let resB: string;
  let lots: Record<string, string>;
  let callA: string;
  const bodies: string[] = [];
  const logs: string[] = [];
  const keys: string[] = []; // toutes les clés R2 créées par les tests

  const api = async (
    userId: string | null,
    method: string,
    path: string,
    residence?: string,
    body?: unknown,
  ) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-test-user'] = userId;
    if (residence) headers['X-Residence-Id'] = residence;
    const response = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    bodies.push(text);
    return { status: response.status, json: (text ? JSON.parse(text) : null) as any, headers: response.headers };
  };
  const as = (name: string, residence = resA) => ({
    get: (path: string) => api(uid(name), 'GET', path, residence),
    post: (path: string, body?: unknown) => api(uid(name), 'POST', path, residence, body ?? {}),
    put: (path: string, body?: unknown) => api(uid(name), 'PUT', path, residence, body ?? {}),
  });

  /** Envoie une vraie image vers R2 par l'URL signée et renvoie sa clé. */
  const uploadInvoice = async (name = 'mgrA', residence = resA) => {
    const response = await as(name, residence).post('/api/expenses/upload-url', {
      contentType: 'image/png',
      size: PNG.byteLength,
    });
    expect(response.status).toBe(200);
    keys.push(response.json.key);
    const put = await fetch(response.json.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: PNG,
    });
    expect(put.status).toBe(200);
    return response.json.key as string;
  };

  const newExpense = (name: string, extra: Record<string, unknown> = {}, residence = resA) =>
    as(name, residence).post('/api/expenses', {
      label: 'Plombier · fuite parking',
      amount: 600 * MAD,
      category: 'repairs',
      ...extra,
    });

  beforeAll(async () => {
    // Journal capturé : aucune URL signée ni clé d'objet ne doit y être écrite.
    for (const method of ['log', 'error', 'warn'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      });
    }
    ({ app } = await import('./app'));
    r2 = await import('./storage/r2');
    r2.setStorageForTests(undefined); // vrai bucket
    const db = getDb();
    await db.insert(schema.user).values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));

    const [a] = await db
      .insert(schema.residence)
      .values({ name: `${tag} Al Andalous`, city: 'Casablanca' })
      .returning({ id: schema.residence.id });
    const [b] = await db
      .insert(schema.residence)
      .values({ name: `${tag} B`, city: 'Rabat' })
      .returning({ id: schema.residence.id });
    [resA, resB] = [a!.id, b!.id];
    const created = await db
      .insert(schema.lot)
      .values(['A11', 'A12'].map((reference) => ({ residenceId: resA, reference })))
      .returning({ id: schema.lot.id, reference: schema.lot.reference });
    lots = Object.fromEntries(created.map((l) => [l.reference, l.id]));
    const [lotB] = await db
      .insert(schema.lot)
      .values({ residenceId: resB, reference: 'A11' })
      .returning({ id: schema.lot.id });

    const member = (residenceId: string, name: string, role: Role, lotId: string | null = null) => ({
      residenceId,
      userId: uid(name),
      role,
      lotId,
    });
    await db.insert(schema.membership).values([
      member(resA, 'mgrA', 'manager'),
      member(resA, 'treasurerA', 'treasurer'),
      member(resA, 'deputyA', 'deputy'),
      member(resA, 'ownerA11', 'owner', lots.A11),
      member(resA, 'tenantA11', 'tenant', lots.A11),
      member(resA, 'caretakerA', 'caretaker'),
      member(resB, 'mgrB', 'manager'),
      member(resB, 'ownerB', 'owner', lotB!.id),
    ]);

    const call = await api(uid('mgrA'), 'POST', '/api/charge-calls', resA, {
      periodLabel: periodLabelOf('quarterly', today),
      amountPerLot: 450 * MAD,
      dueDate: '2026-12-15',
    });
    expect(call.status).toBe(201);
    callA = call.json.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const db = getDb();
    const ids = (
      await db.select({ id: schema.residence.id }).from(schema.residence).where(like(schema.residence.name, `${tag}%`))
    ).map((row) => row.id);
    if (ids.length > 0) {
      r2.setStorageForTests(undefined);
      const storage = r2.getStorage();
      // Factures (clés suivies et clés enregistrées) puis reçus générés à l'encaissement.
      const rows = await db
        .select({ key: schema.expense.invoiceKey })
        .from(schema.expense)
        .where(inArray(schema.expense.residenceId, ids));
      const { receiptStorageKey } = await import('./receipts/store');
      const receipts = await db
        .select({ residenceId: schema.receipt.residenceId, number: schema.receipt.number })
        .from(schema.receipt)
        .where(inArray(schema.receipt.residenceId, ids));
      const all = new Set([
        ...keys,
        ...rows.flatMap((row) => (row.key ? [row.key] : [])),
        ...receipts.map((row) => receiptStorageKey(row.residenceId, row.number)),
      ]);
      for (const key of all) await storage.deleteObject(key);
      for (const key of all) {
        const url = await storage.getSignedReadUrl(key, { filename: 'x.bin', contentType: 'application/pdf' });
        expect((await fetch(url)).status).toBe(404);
      }

      await db.delete(schema.expense).where(inArray(schema.expense.residenceId, ids));
      await db.delete(schema.openingBalanceChange).where(inArray(schema.openingBalanceChange.residenceId, ids));
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

  describe('URL d\'envoi d\'une facture', () => {
    it('refuse un .exe et un fichier de 15 Mo (400)', async () => {
      const exe = await as('mgrA').post('/api/expenses/upload-url', {
        contentType: 'application/x-msdownload',
        size: 1000,
      });
      expect(exe.status).toBe(400);
      expect(exe.json).toEqual({ error: EXPENSE_ERRORS.invalidFileType });
      const big = await as('mgrA').post('/api/expenses/upload-url', {
        contentType: 'application/pdf',
        size: 15 * 1024 * 1024,
      });
      expect(big.status).toBe(400);
      expect(big.json).toEqual({ error: EXPENSE_ERRORS.fileTooLarge });
      const bad = await as('mgrA').post('/api/expenses/upload-url', { contentType: 'image/png' });
      expect(bad.status).toBe(400);
    });

    it('un envoi réel d\'image fonctionne ; autre type ou autre taille refusés par R2', async () => {
      const response = await as('treasurerA').post('/api/expenses/upload-url', {
        contentType: 'image/png',
        size: PNG.byteLength,
      });
      expect(response.status).toBe(200);
      const { uploadUrl, key, expiresIn } = response.json;
      keys.push(key);
      expect(expiresIn).toBe(300);
      expect(key).toMatch(new RegExp(`^residences/${resA}/invoices/[0-9a-f-]{36}\\.png$`));
      expect(new URL(uploadUrl).searchParams.get('X-Amz-Expires')).toBe('300');

      const wrongType = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-msdownload' },
        body: PNG,
      });
      expect(wrongType.status).toBeGreaterThanOrEqual(400);
      const wrongSize = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: Buffer.concat([PNG, PNG]),
      });
      expect(wrongSize.status).toBeGreaterThanOrEqual(400);
      expect(await r2.getStorage().headObject(key)).toBeNull();

      const ok = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: PNG,
      });
      expect(ok.status).toBe(200);
      expect(await r2.getStorage().headObject(key)).toEqual({ contentType: 'image/png', size: PNG.byteLength });
    });

    it('les URL signées expirent après 5 minutes (signature vieille de 6 minutes refusée)', async () => {
      const key = await uploadInvoice();
      const old = new Date(Date.now() - 6 * 60 * 1000);
      const readUrl = await r2.getStorage().getSignedReadUrl(key, {
        filename: 'x.png',
        contentType: 'image/png',
        signingDate: old,
      });
      expect((await fetch(readUrl)).status).toBe(403);
      const uploadUrl = await r2.getStorage().getSignedUploadUrl(`residences/${resA}/invoices/${randomUUID()}.png`, {
        contentType: 'image/png',
        size: PNG.byteLength,
        signingDate: old,
      });
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PNG });
      expect(put.status).toBe(403);
    });
  });

  describe('saisie, liste, détail et annulation', () => {
    let expenseId: string;
    let invoiceKey: string;

    it('création avec facture : type et taille lus dans R2, saisie par le rôle', async () => {
      invoiceKey = await uploadInvoice();
      const created = await newExpense('mgrA', { supplier: 'Plomberie Amal', invoiceKey });
      expect(created.status).toBe(201);
      expenseId = created.json.id;
      expect(created.json).toMatchObject({
        label: 'Plombier · fuite parking',
        amount: 60000,
        category: 'repairs',
        spentOn: today,
        supplier: 'Plomberie Amal',
        hasInvoice: true,
        invoiceContentType: 'image/png',
        invoiceSize: PNG.byteLength,
        recordedByRole: 'manager',
        cancelled: false,
      });
      expect(created.json.invoiceKey).toBeUndefined();
      const byTreasurer = await newExpense('treasurerA');
      expect(byTreasurer.status).toBe(201);
      expect(byTreasurer.json).toMatchObject({ hasInvoice: false, recordedByRole: 'treasurer' });
    });

    it('refuse une date future, un montant invalide, un champ en trop', async () => {
      expect((await newExpense('mgrA', { spentOn: '2999-01-01' })).json).toEqual({
        error: EXPENSE_ERRORS.dateInFuture,
      });
      expect((await newExpense('mgrA', { amount: 0 })).status).toBe(400);
      expect((await newExpense('mgrA', { amount: 12.5 })).status).toBe(400);
      expect((await newExpense('mgrA', { residenceId: resB })).status).toBe(400);
    });

    it('clé de facture d\'une autre résidence, inexistante ou mal formée : refus', async () => {
      const keyB = await uploadInvoice('mgrB', resB);
      const other = await newExpense('mgrA', { invoiceKey: keyB });
      expect(other.status).toBe(400);
      expect(other.json).toEqual({ error: EXPENSE_ERRORS.invoiceNotFound });

      const missing = await newExpense('mgrA', {
        invoiceKey: `residences/${resA}/invoices/${randomUUID()}.png`,
      });
      expect(missing.status).toBe(400);
      expect(missing.json).toEqual({ error: EXPENSE_ERRORS.invoiceNotFound });

      for (const invoiceKey of [
        `residences/${resA}/invoices/../${resB}/invoices/x.png`,
        `residences/${resA}/receipts/2026/2026-0001.pdf`,
        'residences/',
      ]) {
        expect((await newExpense('mgrA', { invoiceKey })).json).toEqual({ error: EXPENSE_ERRORS.invoiceNotFound });
      }
    });

    it('fichier présent dans R2 mais d\'un type interdit : refus', async () => {
      const key = `residences/${resA}/invoices/${randomUUID()}.pdf`;
      keys.push(key);
      await r2.getStorage().putObject(key, new Uint8Array([1, 2, 3]), 'application/x-msdownload');
      const response = await newExpense('mgrA', { invoiceKey: key });
      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: EXPENSE_ERRORS.invalidFileType });
    });

    it('liste paginée par date décroissante, sans nom ni clé R2', async () => {
      await newExpense('mgrA', { spentOn: '2020-01-15', label: 'Ancienne', amount: 100 * MAD });
      const all = await as('ownerA11').get('/api/expenses');
      expect(all.status).toBe(200);
      expect(all.json.total).toBe(3);
      const dates = all.json.items.map((item: any) => item.spentOn);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(all.json.items.at(-1).label).toBe('Ancienne');
      const page = await as('ownerA11').get('/api/expenses?limit=1&offset=1');
      expect(page.json.items).toHaveLength(1);
      expect(page.json).toMatchObject({ total: 3, limit: 1, offset: 1 });
      expect((await as('ownerA11').get('/api/expenses?limit=1000')).status).toBe(400);
      expect(JSON.stringify(all.json)).not.toContain('invoices/');
    });

    it('détail : saisie par le rôle (jamais le nom)', async () => {
      const detail = await as('ownerA11').get(`/api/expenses/${expenseId}`);
      expect(detail.status).toBe(200);
      expect(detail.json.recordedByRole).toBe('manager');
      expect((await as('ownerA11').get(`/api/expenses/${randomUUID()}`)).status).toBe(404);
      expect((await as('ownerA11').get('/api/expenses/pas-un-uuid')).status).toBe(404);
    });

    it('URL de lecture de la facture (5 minutes) ; 404 sans facture', async () => {
      const response = await as('ownerA11').get(`/api/expenses/${expenseId}/invoice-url`);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.json.expiresIn).toBe(300);
      expect(new URL(response.json.url).searchParams.get('X-Amz-Expires')).toBe('300');
      const file = await fetch(response.json.url);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
      // Sans signature, le fichier n'est pas public.
      const bare = response.json.url.split('?')[0];
      expect((await fetch(bare)).status).toBeGreaterThanOrEqual(400);

      const withoutInvoice = await newExpense('mgrA', { label: 'Sans facture' });
      const none = await as('mgrA').get(`/api/expenses/${withoutInvoice.json.id}/invoice-url`);
      expect(none.status).toBe(404);
      expect(none.json).toEqual({ error: EXPENSE_ERRORS.invoiceNotFound });
    });

    it('annulation : sans motif 400, avec motif OK, deuxième 409', async () => {
      const victim = (await newExpense('mgrA', { label: 'À annuler', amount: 800 * MAD })).json.id;
      for (const body of [{}, { reason: '   ' }, { reason: 5 }]) {
        const refused = await as('mgrA').post(`/api/expenses/${victim}/cancel`, body);
        expect(refused.status).toBe(400);
        expect(refused.json).toEqual({ error: EXPENSE_ERRORS.cancelReasonRequired });
      }
      const ok = await as('treasurerA').post(`/api/expenses/${victim}/cancel`, { reason: 'Saisie en double' });
      expect(ok.status).toBe(200);
      expect(ok.json).toMatchObject({
        cancelled: true,
        cancelReason: 'Saisie en double',
        cancelledByRole: 'treasurer',
        recordedByRole: 'manager',
      });
      const again = await as('mgrA').post(`/api/expenses/${victim}/cancel`, { reason: 'Encore' });
      expect(again.status).toBe(409);
      expect(again.json).toEqual({ error: EXPENSE_ERRORS.alreadyCancelled });
      // Pas de suppression : la dépense annulée reste lisible par tous.
      const read = await as('ownerA11').get(`/api/expenses/${victim}`);
      expect(read.json).toMatchObject({ cancelled: true, cancelReason: 'Saisie en double' });
      expect((await as('mgrA').post(`/api/expenses/${randomUUID()}/cancel`, { reason: 'x' })).status).toBe(404);
    });

    it('client_id envoyé deux fois : une seule dépense, même réponse', async () => {
      const clientId = randomUUID();
      const first = await newExpense('mgrA', { label: 'Hors ligne', clientId });
      const second = await newExpense('mgrA', { label: 'Hors ligne', clientId });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.json).toEqual(first.json);
      // Envois simultanés.
      const parallelId = randomUUID();
      const results = await Promise.all([1, 2, 3].map(() => newExpense('mgrA', { label: 'Course', clientId: parallelId })));
      expect(new Set(results.map((r) => r.json.id)).size).toBe(1);
      const rows = await getDb()
        .select({ id: schema.expense.id })
        .from(schema.expense)
        .where(
          and(
            eq(schema.expense.residenceId, resA),
            inArray(schema.expense.clientId, [clientId, parallelId]),
          ),
        );
      expect(rows).toHaveLength(2);
      // Le même client_id dans une autre résidence crée une autre dépense.
      const inB = await newExpense('mgrB', { label: 'Hors ligne', clientId }, resB);
      expect(inB.status).toBe(201);
      expect(inB.json.id).not.toBe(first.json.id);
    });
  });

  describe('caisse et solde de départ', () => {
    it('première saisie sans motif acceptée ; correction sans motif 400 ; avec motif historisée', async () => {
      const first = await as('mgrA').put('/api/residences/current/opening-balance', {
        amount: 10000 * MAD,
        asOfDate: '2026-10-01',
      });
      expect(first.status).toBe(200);
      expect(first.json).toMatchObject({ openingBalance: 1000000, corrected: false });

      const noReason = await as('mgrA').put('/api/residences/current/opening-balance', {
        amount: 9000 * MAD,
        asOfDate: '2026-10-01',
      });
      expect(noReason.status).toBe(400);
      expect(noReason.json).toEqual({ error: EXPENSE_ERRORS.openingReasonRequired });
      const blank = await as('mgrA').put('/api/residences/current/opening-balance', {
        amount: 9000 * MAD,
        asOfDate: '2026-10-01',
        reason: '  ',
      });
      expect(blank.status).toBe(400);

      const fixed = await as('mgrA').put('/api/residences/current/opening-balance', {
        amount: 9500 * MAD,
        asOfDate: '2026-10-02',
        reason: 'Erreur de comptage',
      });
      expect(fixed.status).toBe(200);
      expect(fixed.json.corrected).toBe(true);

      const history = await getDb()
        .select()
        .from(schema.openingBalanceChange)
        .where(eq(schema.openingBalanceChange.residenceId, resA))
        .orderBy(schema.openingBalanceChange.changedAt);
      expect(history.map((h) => [h.oldAmount, h.newAmount, h.reason])).toEqual([
        [null, 1000000, null],
        [1000000, 950000, 'Erreur de comptage'],
      ]);
      expect(history[1]!.changedBy).toBe(uid('mgrA'));
      const [res] = await getDb()
        .select({ b: schema.residence.openingBalance, d: schema.residence.openingBalanceDate })
        .from(schema.residence)
        .where(eq(schema.residence.id, resA));
      expect(res).toEqual({ b: 950000, d: '2026-10-02' });

      // Historique (syndic seulement) : plus récent d'abord, sans aucun identifiant de personne.
      const read = await as('mgrA').get('/api/residences/current/opening-balance');
      expect(read.status).toBe(200);
      expect(read.json).toMatchObject({ openingBalance: 950000, openingBalanceDate: '2026-10-02' });
      expect(
        read.json.changes.map((h: { oldAmount: number | null; newAmount: number; reason: string | null }) => [
          h.oldAmount,
          h.newAmount,
          h.reason,
        ]),
      ).toEqual([
        [1000000, 950000, 'Erreur de comptage'],
        [null, 1000000, null],
      ]);
      expect(JSON.stringify(read.json)).not.toContain(uid('mgrA'));
      // Autre résidence : son propre historique (vide) ; autres rôles : refus.
      expect((await as('mgrB', resB).get('/api/residences/current/opening-balance')).json.changes).toEqual([]);
      for (const name of ['treasurerA', 'ownerA11', 'tenantA11', 'caretakerA']) {
        expect((await as(name).get('/api/residences/current/opening-balance')).status, name).toBe(403);
      }
    });

    it('solde exact après dépenses, paiements et annulations', async () => {
      const pay = async (lot: string) => {
        const [due] = await getDb()
          .select({ id: schema.chargeDue.id })
          .from(schema.chargeDue)
          .where(and(eq(schema.chargeDue.chargeCallId, callA), eq(schema.chargeDue.lotId, lots[lot]!)));
        const response = await as('mgrA').post('/api/payments', { chargeDueId: due!.id, amount: 450 * MAD, method: 'cash' });
        expect(response.status).toBe(201);
        return response.json.payment.id as string;
      };
      await pay('A11');
      const second = await pay('A12');
      expect((await as('mgrA').post(`/api/payments/${second}/cancel`, { reason: 'Erreur' })).status).toBe(200);

      // État : départ 9 500 + paiement 450 (un annulé)
      //   − dépenses non annulées : 600 (facture) + 600 + 100 (ancienne) + 600×… voir le calcul ci-dessous.
      const rows = await getDb()
        .select({ amount: schema.expense.amount, cancelled: schema.expense.cancelledAt })
        .from(schema.expense)
        .where(eq(schema.expense.residenceId, resA));
      const spentAll = rows.filter((r) => !r.cancelled).reduce((sum, r) => sum + r.amount, 0);
      const expected = 950000 + 45000 - spentAll;

      const cash = await as('ownerA11').get('/api/cash');
      expect(cash.status).toBe(200);
      expect(cash.json.balance).toBe(expected);
      expect(cash.json).toMatchObject({ openingBalance: 950000, openingBalanceDate: '2026-10-02' });

      // Période en cours : l'ancienne dépense (2020) n'y figure pas ; l'annulée non plus.
      const recent = rows.filter((r) => !r.cancelled).reduce((sum, r) => sum + r.amount, 0) - 100 * MAD;
      expect(cash.json.period).toMatchObject({ collected: 45000, spent: recent });
      expect(cash.json.period.label).toBe(periodLabelOf('quarterly', today));

      // Journal : paiements et dépenses fusionnés, « Charge reçue · A11 », aucun nom.
      const ledger = cash.json.ledger;
      expect(ledger.total).toBe(rows.length + 2);
      const labels = ledger.items.map((i: any) => i.label);
      expect(labels).toContain('Charge reçue · A11');
      const cancelledPayment = ledger.items.find((i: any) => i.kind === 'payment' && i.cancelled);
      expect(cancelledPayment).toBeDefined();
      const page = await as('ownerA11').get('/api/cash?limit=2&offset=0');
      expect(page.json.ledger.items).toHaveLength(2);
      expect(page.json.balance).toBe(expected);
      expect((await as('ownerA11').get('/api/cash?limit=500')).status).toBe(400);

      // Annuler une dépense rétablit le solde.
      const target = (await as('mgrA').get('/api/expenses?limit=100')).json.items.find(
        (i: any) => i.label === 'Sans facture',
      );
      await as('mgrA').post(`/api/expenses/${target.id}/cancel`, { reason: 'Erreur' });
      const after = await as('ownerA11').get('/api/cash');
      expect(after.json.balance).toBe(expected + target.amount);
    });
  });

  describe('permissions', () => {
    const anyId = randomUUID();
    const routes = (name: string) => [
      ['read', () => as(name).get('/api/expenses')],
      ['read', () => as(name).get(`/api/expenses/${anyId}`)],
      ['read', () => as(name).get(`/api/expenses/${anyId}/invoice-url`)],
      ['read', () => as(name).get('/api/cash')],
      ['write', () => as(name).post('/api/expenses/upload-url', { contentType: 'image/png', size: 10 })],
      ['write', () => newExpense(name)],
      ['write', () => as(name).post(`/api/expenses/${anyId}/cancel`, { reason: 'x' })],
      ['manage', () => as(name).put('/api/residences/current/opening-balance', { amount: 100, asOfDate: '2026-10-01', reason: 'x' })],
    ] as const;

    it.each(['tenantA11', 'caretakerA'])('%s : 403 sur toutes les routes', async (name) => {
      for (const [, call] of routes(name)) expect((await call()).status).toBe(403);
    });

    it.each(['deputyA', 'ownerA11'])('%s : lecture seule', async (name) => {
      for (const [kind, call] of routes(name)) {
        const { status } = await call();
        if (kind === 'read') expect(status).not.toBe(403);
        else expect(status).toBe(403);
      }
    });

    it('trésorier : saisit, annule et lit, mais ne modifie pas le solde de départ', async () => {
      for (const [kind, call] of routes('treasurerA')) {
        const { status } = await call();
        if (kind === 'manage') expect(status).toBe(403);
        else expect(status).not.toBe(403);
      }
    });

    it('syndic : toutes les routes ouvertes', async () => {
      for (const [, call] of routes('mgrA')) expect((await call()).status).not.toBe(403);
    });

    it('sans session : 401 ; sans en-tête de résidence : 400', async () => {
      expect((await api(null, 'GET', '/api/cash', resA)).status).toBe(401);
      expect((await api(null, 'POST', '/api/expenses', resA, {})).status).toBe(401);
      expect((await api(uid('mgrA'), 'GET', '/api/cash')).status).toBe(400);
    });
  });

  describe('isolation entre résidences', () => {
    let expenseA: string;
    beforeAll(async () => {
      const key = await uploadInvoice();
      expenseA = (await newExpense('mgrA', { label: 'Secret A', invoiceKey: key })).json.id;
    });

    it('un syndic de B ne lit ni n\'annule les dépenses de A, avec son propre en-tête', async () => {
      const b = as('mgrB', resB);
      expect((await b.get(`/api/expenses/${expenseA}`)).status).toBe(404);
      expect((await b.get(`/api/expenses/${expenseA}/invoice-url`)).status).toBe(404);
      expect((await b.post(`/api/expenses/${expenseA}/cancel`, { reason: 'Piratage' })).status).toBe(404);
      const [row] = await getDb().select().from(schema.expense).where(eq(schema.expense.id, expenseA));
      expect(row!.cancelledAt).toBeNull();
      const list = await b.get('/api/expenses');
      expect(JSON.stringify(list.json)).not.toContain('Secret A');
      const cash = await b.get('/api/cash');
      const own = (await b.get('/api/expenses')).json.items as any[];
      expect(cash.json.balance).toBe(-own.filter((i) => !i.cancelled).reduce((sum, i) => sum + i.amount, 0));
      expect(cash.json.ledger.total).toBe(own.length);
      expect(JSON.stringify(cash.json)).not.toContain('Secret A');
    });

    it('en-tête de A avec un utilisateur de B : 403 sur chaque route', async () => {
      const b = as('mgrB', resA);
      expect((await b.get('/api/expenses')).status).toBe(403);
      expect((await b.get(`/api/expenses/${expenseA}`)).status).toBe(403);
      expect((await b.get(`/api/expenses/${expenseA}/invoice-url`)).status).toBe(403);
      expect((await b.post(`/api/expenses/${expenseA}/cancel`, { reason: 'x' })).status).toBe(403);
      expect((await b.post('/api/expenses/upload-url', { contentType: 'image/png', size: 10 })).status).toBe(403);
      expect((await newExpense('mgrB', {}, resA)).status).toBe(403);
      expect((await b.get('/api/cash')).status).toBe(403);
      expect((await b.put('/api/residences/current/opening-balance', { amount: 1, asOfDate: '2026-10-01' })).status).toBe(403);
      expect((await as('mgrA', randomUUID()).get('/api/cash')).status).toBe(403);
    });

    it('le solde de départ de B ne touche pas A, et inversement', async () => {
      const before = (await as('mgrA').get('/api/cash')).json.balance;
      const set = await as('mgrB', resB).put('/api/residences/current/opening-balance', {
        amount: 777 * MAD,
        asOfDate: '2026-10-01',
      });
      expect(set.status).toBe(200);
      expect((await as('mgrA').get('/api/cash')).json.balance).toBe(before);
      const own = (await as('mgrB', resB).get('/api/expenses')).json.items as any[];
      const spent = own.filter((i) => !i.cancelled).reduce((sum, i) => sum + i.amount, 0);
      expect((await as('mgrB', resB).get('/api/cash')).json.balance).toBe(777 * MAD - spent);
    });

    it('l\'URL d\'envoi de B est dans le préfixe de B', async () => {
      const response = await as('mgrB', resB).post('/api/expenses/upload-url', { contentType: 'image/jpeg', size: 100 });
      expect(response.json.key.startsWith(`residences/${resB}/invoices/`)).toBe(true);
      expect(response.json.key.endsWith('.jpg')).toBe(true);
    });
  });

  describe('données personnelles et journaux', () => {
    it('aucune réponse ne contient de nom ou d\'e-mail', () => {
      expect(bodies.length).toBeGreaterThan(50);
      for (const body of bodies) {
        expect(body).not.toContain('@test.invalid');
        expect(body).not.toContain(`${tag}-`);
      }
    });

    it('aucune URL signée ni clé d\'objet dans les journaux', () => {
      for (const line of logs) {
        expect(line).not.toContain('X-Amz');
        expect(line).not.toContain('/invoices/');
        expect(line).not.toContain('r2.cloudflarestorage.com');
      }
    });
  });
});
