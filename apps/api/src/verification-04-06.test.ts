/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Vérification des plans 04, 05 et 06 : matrice des permissions (rôle × route) et isolation entre
// deux résidences, sur toutes les routes métier. Base de DATABASE_URL (branche Neon dev) et bucket
// R2 des variables R2_* (syndicapp-dev). Tout ce qui est créé est supprimé à la fin.
//
// Les écritures sont sondées avec un corps vide : la permission est vérifiée avant la validation,
// donc un rôle autorisé reçoit 400 et un rôle refusé 403, sans rien modifier en base.
// Si VERIFY_OUT est défini, la matrice observée y est écrite en JSON.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { periodLabelOf, todayInCasablanca, type Role } from '@syndic/shared';
import { eq, inArray, like } from 'drizzle-orm';
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
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Identifiants des objets d'une résidence, utilisés dans les chemins sondés. */
type Ids = { call: string; payment: string; receipt: string; expense: string; invitation: string };

/** Route sondée : méthode, chemin (selon les objets visés) et corps éventuel. */
type Probe = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: (ids: Ids) => string;
  body?: unknown;
  /** Rôles autorisés (dans la résidence active). */
  allowed: readonly string[];
};

const ALL = ['manager', 'treasurer', 'deputy', 'owner', 'ownerOtherLot', 'tenant', 'caretaker'];
const ACCOUNTS = ['manager', 'treasurer', 'deputy', 'owner', 'ownerOtherLot'];
const COLLECTORS = ['manager', 'treasurer'];

const PROBES: Probe[] = [
  { name: 'GET /residences/current', method: 'GET', path: () => '/api/residences/current', allowed: ALL },
  { name: 'PATCH /residences/current', method: 'PATCH', path: () => '/api/residences/current', body: {}, allowed: ['manager'] },
  { name: 'GET /residences/current/opening-balance', method: 'GET', path: () => '/api/residences/current/opening-balance', allowed: ['manager'] },
  { name: 'PUT /residences/current/opening-balance', method: 'PUT', path: () => '/api/residences/current/opening-balance', body: {}, allowed: ['manager'] },
  { name: 'GET /lots', method: 'GET', path: () => '/api/lots', allowed: ['manager'] },
  { name: 'POST /lots', method: 'POST', path: () => '/api/lots', body: {}, allowed: ['manager'] },
  { name: 'POST /lots/bulk', method: 'POST', path: () => '/api/lots/bulk', body: {}, allowed: ['manager'] },
  { name: 'GET /invitations', method: 'GET', path: () => '/api/invitations', allowed: ['manager'] },
  { name: 'POST /invitations', method: 'POST', path: () => '/api/invitations', body: {}, allowed: ['manager'] },
  { name: 'DELETE /invitations/:id', method: 'DELETE', path: () => `/api/invitations/${randomUUID()}`, allowed: ['manager'] },
  { name: 'GET /charge-calls', method: 'GET', path: () => '/api/charge-calls', allowed: ACCOUNTS },
  { name: 'GET /charge-calls/:id', method: 'GET', path: (ids) => `/api/charge-calls/${ids.call}`, allowed: COLLECTORS },
  { name: 'POST /charge-calls', method: 'POST', path: () => '/api/charge-calls', body: {}, allowed: ['manager'] },
  { name: 'POST /payments', method: 'POST', path: () => '/api/payments', body: {}, allowed: COLLECTORS },
  { name: 'POST /payments/:id/cancel', method: 'POST', path: (ids) => `/api/payments/${ids.payment}/cancel`, body: {}, allowed: COLLECTORS },
  { name: 'GET /me/dues', method: 'GET', path: () => '/api/me/dues', allowed: ACCOUNTS },
  { name: 'GET /receipts/:id', method: 'GET', path: (ids) => `/api/receipts/${ids.receipt}`, allowed: [...COLLECTORS, 'owner'] },
  { name: 'GET /receipts/:id/url', method: 'GET', path: (ids) => `/api/receipts/${ids.receipt}/url`, allowed: [...COLLECTORS, 'owner'] },
  { name: 'POST /expenses/upload-url', method: 'POST', path: () => '/api/expenses/upload-url', body: {}, allowed: COLLECTORS },
  { name: 'POST /expenses', method: 'POST', path: () => '/api/expenses', body: {}, allowed: COLLECTORS },
  { name: 'GET /expenses', method: 'GET', path: () => '/api/expenses', allowed: ACCOUNTS },
  { name: 'GET /expenses/:id', method: 'GET', path: (ids) => `/api/expenses/${ids.expense}`, allowed: ACCOUNTS },
  { name: 'POST /expenses/:id/cancel', method: 'POST', path: (ids) => `/api/expenses/${ids.expense}/cancel`, body: {}, allowed: COLLECTORS },
  { name: 'GET /expenses/:id/invoice-url', method: 'GET', path: (ids) => `/api/expenses/${ids.expense}/invoice-url`, allowed: ACCOUNTS },
  { name: 'GET /cash', method: 'GET', path: () => '/api/cash', allowed: ACCOUNTS },
];

describe.skipIf(!configured)('Vérification des plans 04 à 06', { timeout: 300_000 }, () => {
  const tag = `verif-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  // Membres de A, par rôle sondé ; puis le syndic de B.
  const MEMBERS_A: Record<string, { role: Role; lot: 'A11' | 'A12' | null }> = {
    manager: { role: 'manager', lot: null },
    treasurer: { role: 'treasurer', lot: null },
    deputy: { role: 'deputy', lot: null },
    owner: { role: 'owner', lot: 'A11' },
    ownerOtherLot: { role: 'owner', lot: 'A12' },
    tenant: { role: 'tenant', lot: 'A11' },
    caretaker: { role: 'caretaker', lot: null },
  };
  const users = [...Object.keys(MEMBERS_A), 'mgrB'].map(uid);
  let app: (typeof import('./app'))['app'];
  let r2: typeof import('./storage/r2');
  let resA: string;
  let resB: string;
  const ids: Record<'A' | 'B', Ids> = { A: {} as Ids, B: {} as Ids };
  const keys: string[] = [];

  const api = async (userId: string, method: string, path: string, residence?: string, body?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-test-user': userId };
    if (residence) headers['X-Residence-Id'] = residence;
    const response = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };

  /** Crée dans une résidence : appel de charges, paiement (reçu), dépense avec facture, invitation. */
  const seed = async (manager: string, residence: string, lotId: string): Promise<Ids> => {
    const call = await api(manager, 'POST', '/api/charge-calls', residence, {
      periodLabel: periodLabelOf('quarterly', today),
      amountPerLot: 450 * MAD,
      dueDate: '2026-12-15',
    });
    expect(call.status).toBe(201);
    const detail = await api(manager, 'GET', `/api/charge-calls/${call.json.id}`, residence);
    const due = detail.json.dues.find((d: any) => d.lotId === lotId);
    const payment = await api(manager, 'POST', '/api/payments', residence, {
      chargeDueId: due.id,
      amount: 450 * MAD,
      method: 'cash',
    });
    expect(payment.status).toBe(201);

    const upload = await api(manager, 'POST', '/api/expenses/upload-url', residence, {
      contentType: 'image/png',
      size: PNG.byteLength,
    });
    expect(upload.status).toBe(200);
    keys.push(upload.json.key);
    const put = await fetch(upload.json.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: PNG,
    });
    expect(put.status).toBe(200);
    const expense = await api(manager, 'POST', '/api/expenses', residence, {
      label: 'Plombier · fuite parking',
      amount: 600 * MAD,
      category: 'repairs',
      invoiceKey: upload.json.key,
    });
    expect(expense.status).toBe(201);

    const invitation = await api(manager, 'POST', '/api/invitations', residence, { role: 'caretaker' });
    expect(invitation.status).toBe(201);
    return {
      call: call.json.id,
      payment: payment.json.payment.id,
      receipt: payment.json.receipt.id,
      expense: expense.json.id,
      invitation: invitation.json.id,
    };
  };

  /** Empreinte des données de B (tout ce qu'une écriture croisée pourrait modifier). */
  const fingerprintB = async () => {
    const db = getDb();
    const [residence] = await db.select().from(schema.residence).where(eq(schema.residence.id, resB));
    const tables = await Promise.all([
      db.select().from(schema.lot).where(eq(schema.lot.residenceId, resB)),
      db.select().from(schema.membership).where(eq(schema.membership.residenceId, resB)),
      db.select().from(schema.invitation).where(eq(schema.invitation.residenceId, resB)),
      db.select().from(schema.chargeCall).where(eq(schema.chargeCall.residenceId, resB)),
      db.select().from(schema.chargeDue).where(eq(schema.chargeDue.residenceId, resB)),
      db.select().from(schema.payment).where(eq(schema.payment.residenceId, resB)),
      db.select().from(schema.receipt).where(eq(schema.receipt.residenceId, resB)),
      db.select().from(schema.expense).where(eq(schema.expense.residenceId, resB)),
      db.select().from(schema.openingBalanceChange).where(eq(schema.openingBalanceChange.residenceId, resB)),
    ]);
    const sort = (rows: any[]) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return JSON.stringify([residence, ...tables.map(sort)]);
  };

  beforeAll(async () => {
    for (const method of ['log', 'error', 'warn'] as const) {
      vi.spyOn(console, method).mockImplementation(() => {});
    }
    ({ app } = await import('./app'));
    r2 = await import('./storage/r2');
    r2.setStorageForTests(undefined);
    const db = getDb();
    await db.insert(schema.user).values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));

    const [a] = await db
      .insert(schema.residence)
      .values({ name: `${tag} A`, city: 'Casablanca' })
      .returning({ id: schema.residence.id });
    const [b] = await db
      .insert(schema.residence)
      .values({ name: `${tag} B`, city: 'Rabat' })
      .returning({ id: schema.residence.id });
    [resA, resB] = [a!.id, b!.id];
    const lotsA = await db
      .insert(schema.lot)
      .values(['A11', 'A12'].map((reference) => ({ residenceId: resA, reference })))
      .returning({ id: schema.lot.id, reference: schema.lot.reference });
    const lotA = Object.fromEntries(lotsA.map((l) => [l.reference, l.id]));
    const [lotB] = await db
      .insert(schema.lot)
      .values({ residenceId: resB, reference: 'B11' })
      .returning({ id: schema.lot.id });

    await db.insert(schema.membership).values([
      ...Object.entries(MEMBERS_A).map(([name, { role, lot }]) => ({
        residenceId: resA,
        userId: uid(name),
        role,
        lotId: lot ? lotA[lot]! : null,
      })),
      { residenceId: resB, userId: uid('mgrB'), role: 'manager' as const, lotId: null },
    ]);

    ids.A = await seed(uid('manager'), resA, lotA.A11!);
    ids.B = await seed(uid('mgrB'), resB, lotB!.id);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const db = getDb();
    const residenceIds = (
      await db.select({ id: schema.residence.id }).from(schema.residence).where(like(schema.residence.name, `${tag}%`))
    ).map((row) => row.id);
    if (residenceIds.length > 0) {
      r2.setStorageForTests(undefined);
      const storage = r2.getStorage();
      const invoices = await db
        .select({ key: schema.expense.invoiceKey })
        .from(schema.expense)
        .where(inArray(schema.expense.residenceId, residenceIds));
      const { receiptStorageKey } = await import('./receipts/store');
      const receipts = await db
        .select({ residenceId: schema.receipt.residenceId, number: schema.receipt.number })
        .from(schema.receipt)
        .where(inArray(schema.receipt.residenceId, residenceIds));
      const all = new Set([
        ...keys,
        ...invoices.flatMap((row) => (row.key ? [row.key] : [])),
        ...receipts.map((row) => receiptStorageKey(row.residenceId, row.number)),
      ]);
      for (const key of all) await storage.deleteObject(key);

      await db.delete(schema.expense).where(inArray(schema.expense.residenceId, residenceIds));
      await db.delete(schema.openingBalanceChange).where(inArray(schema.openingBalanceChange.residenceId, residenceIds));
      await db.delete(schema.receipt).where(inArray(schema.receipt.residenceId, residenceIds));
      await db.delete(schema.payment).where(inArray(schema.payment.residenceId, residenceIds));
      await db.delete(schema.chargeDue).where(inArray(schema.chargeDue.residenceId, residenceIds));
      await db.delete(schema.chargeCall).where(inArray(schema.chargeCall.residenceId, residenceIds));
      await db.delete(schema.receiptCounter).where(inArray(schema.receiptCounter.residenceId, residenceIds));
      await db.delete(schema.invitation).where(inArray(schema.invitation.residenceId, residenceIds));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, residenceIds));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, residenceIds));
      await db.delete(schema.residence).where(inArray(schema.residence.id, residenceIds));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  it('matrice des permissions : chaque rôle reçoit 403 exactement sur les routes qui ne sont pas les siennes', async () => {
    const matrix: Record<string, Record<string, number>> = {};
    for (const probe of PROBES) {
      matrix[probe.name] = {};
      for (const name of Object.keys(MEMBERS_A)) {
        const response = await api(uid(name), probe.method, probe.path(ids.A), resA, probe.body);
        matrix[probe.name]![name] = response.status;
      }
    }
    if (process.env.VERIFY_OUT) writeFileSync(process.env.VERIFY_OUT, JSON.stringify(matrix, null, 2));

    for (const probe of PROBES) {
      for (const name of Object.keys(MEMBERS_A)) {
        const status = matrix[probe.name]![name];
        const expected = probe.allowed.includes(name) ? 'autorisé' : 'refusé';
        expect({ route: probe.name, role: name, result: status === 403 ? 'refusé' : 'autorisé' }).toEqual({
          route: probe.name,
          role: name,
          result: expected,
        });
        expect(status, `${probe.name} / ${name}`).toBeLessThan(500);
      }
    }
  });

  it('isolation : le syndic de A, avec l’en-tête de B, reçoit 403 sur chaque route et B ne bouge pas', async () => {
    const before = await fingerprintB();
    for (const probe of PROBES) {
      const response = await api(uid('manager'), probe.method, probe.path(ids.B), resB, probe.body);
      expect({ route: probe.name, status: response.status }).toEqual({ route: probe.name, status: 403 });
    }
    expect(await fingerprintB()).toBe(before);
  });

  it('isolation : avec l’en-tête de A, les identifiants de B sont introuvables et B ne bouge pas', async () => {
    const before = await fingerprintB();
    // Routes à identifiant, et écritures réelles (corps valides) visant les objets de B.
    const attempts: [string, string, unknown?][] = [
      ['GET', `/api/charge-calls/${ids.B.call}`],
      ['POST', `/api/payments/${ids.B.payment}/cancel`, { reason: 'test croisé' }],
      ['GET', `/api/receipts/${ids.B.receipt}`],
      ['GET', `/api/receipts/${ids.B.receipt}/url`],
      ['GET', `/api/expenses/${ids.B.expense}`],
      ['POST', `/api/expenses/${ids.B.expense}/cancel`, { reason: 'test croisé' }],
      ['GET', `/api/expenses/${ids.B.expense}/invoice-url`],
      ['DELETE', `/api/invitations/${ids.B.invitation}`],
    ];
    for (const [method, path, body] of attempts) {
      const response = await api(uid('manager'), method, path, resA, body);
      expect({ path, status: response.status }).toEqual({ path, status: 404 });
    }
    // Paiement sur un dû de B, facture de B : refusés.
    const dueB = (await getDb().select({ id: schema.chargeDue.id }).from(schema.chargeDue).where(eq(schema.chargeDue.residenceId, resB)))[0]!;
    const pay = await api(uid('manager'), 'POST', '/api/payments', resA, { chargeDueId: dueB.id, amount: 100, method: 'cash' });
    expect(pay.status).toBe(404);
    const [expB] = await getDb().select({ key: schema.expense.invoiceKey }).from(schema.expense).where(eq(schema.expense.id, ids.B.expense));
    const steal = await api(uid('manager'), 'POST', '/api/expenses', resA, {
      label: 'Facture de B',
      amount: 100,
      category: 'other',
      invoiceKey: expB!.key,
    });
    expect(steal.status).toBe(400);
    expect(steal.json.error).toBe('expenses.errors.invoiceNotFound');
    expect(await fingerprintB()).toBe(before);
  });

  it('isolation : les listes de A ne contiennent aucun identifiant de B', async () => {
    const bValues = [resB, ...Object.values(ids.B)];
    for (const path of ['/api/residences', '/api/residences/current', '/api/lots', '/api/invitations', '/api/charge-calls', '/api/me/dues', '/api/expenses', '/api/cash']) {
      const response = await api(uid('manager'), 'GET', path, resA);
      expect(response.status).toBe(200);
      for (const value of bValues) expect(response.text, path).not.toContain(value);
    }
  });

  it('résidence inexistante : réponse identique à celle d’une résidence existante dont on n’est pas membre', async () => {
    const ghost = randomUUID();
    for (const probe of PROBES) {
      const existing = await api(uid('manager'), probe.method, probe.path(ids.B), resB, probe.body);
      const missing = await api(uid('manager'), probe.method, probe.path(ids.B), ghost, probe.body);
      expect({ route: probe.name, status: missing.status, body: missing.text }).toEqual({
        route: probe.name,
        status: existing.status,
        body: existing.text,
      });
    }
  });
});
