/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration des reçus PDF (plan 05, étape 3) : base de DATABASE_URL (branche Neon dev)
// et bucket R2 des variables R2_* (syndicapp-dev). Tous les fichiers et toutes les données créés
// sont supprimés à la fin. Sans base ou sans R2, les tests sont ignorés.
// La session est simulée par l'en-tête x-test-user : tout le reste (routes, base, R2) est réel.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { CHARGE_ERRORS, periodLabelOf, todayInCasablanca, type Role } from '@syndic/shared';
import { and, eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { pdfText } from './test-utils/pdf-text';

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

const SAMPLES_DIR = resolve(import.meta.dirname, '../tmp/receipts');
const MAD = 100;
const today = todayInCasablanca();

describe.skipIf(!configured)('reçus PDF et R2', { timeout: 120_000 }, () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const names = [
    'mgrA',
    'treasurerA',
    'deputyA',
    'ownerA11',
    'ownerA12',
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

  const api = async (userId: string | null, method: string, path: string, residence?: string, body?: unknown) => {
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

  const dueId = async (lotRef: string) => {
    const [row] = await getDb()
      .select({ id: schema.chargeDue.id })
      .from(schema.chargeDue)
      .where(and(eq(schema.chargeDue.chargeCallId, callA), eq(schema.chargeDue.lotId, lots[lotRef]!)));
    return row!.id;
  };

  const pay = async (lotRef: string, amount = 450 * MAD) => {
    const response = await api(uid('mgrA'), 'POST', '/api/payments', resA, {
      chargeDueId: await dueId(lotRef),
      amount,
      method: 'cash',
    });
    expect(response.status).toBe(201);
    return response.json as { payment: { id: string }; receipt: { id: string; number: string } };
  };

  const storageKeyOf = async (receiptId: string) =>
    (
      await getDb()
        .select({ key: schema.receipt.storageKey })
        .from(schema.receipt)
        .where(eq(schema.receipt.id, receiptId))
    )[0]!.key;

  const receiptUrl = (user: string, receiptId: string, residence = resA) =>
    api(uid(user), 'GET', `/api/receipts/${receiptId}/url`, residence);

  /** Télécharge le PDF par son URL signée (vraie requête vers R2). */
  const download = async (url: string) => {
    const response = await fetch(url);
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  };

  beforeAll(async () => {
    // Journal capturé : on vérifie qu'aucune URL signée ni clé d'objet n'y est écrite.
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
      .values(['A11', 'A12', 'A13'].map((reference) => ({ residenceId: resA, reference })))
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
      member(resA, 'ownerA12', 'owner', lots.A12),
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
      // Fichiers R2 : toutes les clés possibles des reçus créés (enregistrées ou non).
      const { receiptStorageKey } = await import('./receipts/store');
      const rows = await db
        .select({ residenceId: schema.receipt.residenceId, number: schema.receipt.number })
        .from(schema.receipt)
        .where(inArray(schema.receipt.residenceId, ids));
      r2.setStorageForTests(undefined);
      const storage = r2.getStorage();
      const keys = rows.map((row) => receiptStorageKey(row.residenceId, row.number));
      for (const key of keys) await storage.deleteObject(key);
      // Vérification : plus aucun fichier lisible.
      for (const key of keys) {
        const url = await storage.getSignedReadUrl(key, { filename: 'x.pdf', contentType: 'application/pdf' });
        expect((await fetch(url)).status).toBe(404);
      }

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

  let paid: { payment: { id: string }; receipt: { id: string; number: string } };

  it('un encaissement crée le PDF dans R2 et enregistre storage_key', async () => {
    paid = await pay('A11');
    const key = await storageKeyOf(paid.receipt.id);
    const year = paid.receipt.number.slice(0, 4);
    expect(key).toBe(`residences/${resA}/receipts/${year}/${paid.receipt.number}.pdf`);
  });

  it('l\'URL signée ouvre le PDF : 5 minutes, nom recu-<numéro>.pdf', async () => {
    const response = await receiptUrl('mgrA', paid.receipt.id);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const filename = `recu-${paid.receipt.number}.pdf`;
    expect(response.json).toMatchObject({ expiresIn: 300, filename });
    const url = new URL(response.json.url);
    expect(url.hostname).toBe(`${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');

    const file = await download(response.json.url);
    expect(file.status).toBe(200);
    expect(file.type).toBe('application/pdf');
    expect(file.disposition).toBe(`inline; filename="${filename}"`);
    expect(Buffer.from(file.bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    const text = await pdfText(file.bytes);
    expect(text).toContain(`Reçu n° ${paid.receipt.number}`);
    expect(text).toContain('450 MAD');
    expect(text).toContain('Payé');
    expect(text).toContain('Le syndic');
    expect(text).not.toContain('ANNULÉ');
    mkdirSync(SAMPLES_DIR, { recursive: true });
    writeFileSync(resolve(SAMPLES_DIR, `integration-${filename}`), file.bytes);
  });

  it('une URL signée il y a plus de 5 minutes ne fonctionne plus', async () => {
    const key = (await storageKeyOf(paid.receipt.id))!;
    const storage = r2.getStorage();
    const options = { filename: 'recu.pdf', contentType: 'application/pdf' };
    const recent = await storage.getSignedReadUrl(key, {
      ...options,
      signingDate: new Date(Date.now() - 4 * 60_000),
    });
    expect((await fetch(recent)).status).toBe(200);
    const expired = await storage.getSignedReadUrl(key, {
      ...options,
      signingDate: new Date(Date.now() - 6 * 60_000),
    });
    expect((await fetch(expired)).status).toBe(403);
  });

  it('accès : syndic, trésorier et copropriétaire du lot', async () => {
    for (const name of ['mgrA', 'treasurerA', 'ownerA11']) {
      expect((await receiptUrl(name, paid.receipt.id)).status, name).toBe(200);
    }
  });

  it('refusé : copropriétaire d\'un autre appartement, locataire, adjoint, gardien (403)', async () => {
    // Le locataire habite pourtant le lot A11 : il n'a aucun accès aux comptes.
    for (const name of ['ownerA12', 'tenantA11', 'deputyA', 'caretakerA']) {
      const response = await receiptUrl(name, paid.receipt.id);
      expect(response.status, name).toBe(403);
      expect(response.json).toEqual({ error: 'forbidden' });
    }
  });

  it('détail du reçu : rôle de l\'encaisseur, jamais son nom ; mêmes règles d\'accès', async () => {
    const detail = (user: string, residence = resA) =>
      api(uid(user), 'GET', `/api/receipts/${paid.receipt.id}`, residence);
    const owner = await detail('ownerA11');
    expect(owner.status).toBe(200);
    expect(owner.json).toEqual({
      id: paid.receipt.id,
      number: paid.receipt.number,
      residenceName: `${tag} Al Andalous`,
      lotReference: 'A11',
      periodLabel: periodLabelOf('quarterly', today),
      amount: 45_000,
      method: 'cash',
      paidAt: expect.any(String),
      recordedByRole: 'manager',
      cancelledAt: null,
    });
    expect((await detail('treasurerA')).status).toBe(200);
    for (const name of ['ownerA12', 'tenantA11', 'deputyA', 'caretakerA', 'ownerB']) {
      expect((await detail(name)).status, name).toBe(403);
    }
    expect((await detail('mgrB', resB)).status).toBe(404);
  });

  it('aucun accès croisé entre résidences', async () => {
    // Non membre de A : 403 (membership), même réponse qu'une résidence inexistante.
    expect((await receiptUrl('ownerB', paid.receipt.id)).status).toBe(403);
    expect((await receiptUrl('mgrB', paid.receipt.id)).status).toBe(403);
    // Membre de B, en-tête B : le reçu de A est introuvable dans B.
    const fromB = await receiptUrl('mgrB', paid.receipt.id, resB);
    expect(fromB.status).toBe(404);
    expect(fromB.json).toEqual({ error: CHARGE_ERRORS.notFound });
    // Membre de A, en-tête B : 403.
    expect((await receiptUrl('mgrA', paid.receipt.id, resB)).status).toBe(403);
  });

  it('401 sans session ; identifiant inconnu ou invalide : 404', async () => {
    expect((await api(null, 'GET', `/api/receipts/${paid.receipt.id}/url`, resA)).status).toBe(401);
    expect((await receiptUrl('mgrA', randomUUID())).status).toBe(404);
    expect((await receiptUrl('mgrA', 'pas-un-uuid')).status).toBe(404);
  });

  it('un paiement annulé a un PDF marqué « ANNULÉ », sous la même clé', async () => {
    const key = await storageKeyOf(paid.receipt.id);
    const cancel = await api(uid('treasurerA'), 'POST', `/api/payments/${paid.payment.id}/cancel`, resA, {
      reason: 'Erreur de lot',
    });
    expect(cancel.status).toBe(200);
    expect(cancel.json.receipt).toEqual({ id: paid.receipt.id });
    expect(await storageKeyOf(paid.receipt.id)).toBe(key);

    const response = await receiptUrl('ownerA11', paid.receipt.id);
    expect(response.status).toBe(200);
    const file = await download(response.json.url);
    const text = await pdfText(file.bytes);
    expect(text).toContain('ANNULÉ');
    expect(text).toContain('Paiement annulé le');
    expect(text).toContain(paid.receipt.number);
    writeFileSync(resolve(SAMPLES_DIR, `integration-recu-${paid.receipt.number}-annule.pdf`), file.bytes);
  });

  it('R2 en panne : l\'encaissement reste valide, le PDF est généré à la première demande', async () => {
    r2.setStorageForTests({
      putObject: async () => {
        throw Object.assign(new Error('panne simulée residences/secret'), { name: 'NetworkingError' });
      },
      getSignedReadUrl: async () => {
        throw new Error('indisponible');
      },
      deleteObject: async () => undefined,
      getSignedUploadUrl: async () => 'https://stockage.invalid/envoi',
      headObject: async () => null,
    });
    let failed: Awaited<ReturnType<typeof pay>>;
    try {
      failed = await pay('A12');
    } finally {
      r2.setStorageForTests(undefined);
    }
    expect(await storageKeyOf(failed.receipt.id)).toBeNull();
    const [due] = await getDb()
      .select({ status: schema.chargeDue.status })
      .from(schema.chargeDue)
      .where(eq(schema.chargeDue.id, await dueId('A12')));
    expect(due!.status).toBe('paid');
    // Le journal ne contient que le nom de l'erreur, pas son message.
    const line = logs.find((entry) => entry.includes(failed.receipt.id));
    expect(line).toContain('NetworkingError');
    expect(line).not.toContain('panne simulée');

    const response = await receiptUrl('ownerA12', failed.receipt.id);
    expect(response.status).toBe(200);
    expect(await storageKeyOf(failed.receipt.id)).toMatch(/^residences\/.+\.pdf$/);
    const file = await download(response.json.url);
    expect(await pdfText(file.bytes)).toContain(failed.receipt.number);
  });

  it('ni URL signée ni clé d\'objet dans les journaux ; aucun nom ni e-mail dans les réponses', () => {
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain('X-Amz-Signature');
      expect(line).not.toContain('r2.cloudflarestorage.com');
      expect(line).not.toContain('residences/');
    }
    const leaks = bodies.filter((body) => users.some((id) => body.includes(id)) || body.includes('@test.invalid'));
    expect(leaks).toEqual([]);
  });
});
