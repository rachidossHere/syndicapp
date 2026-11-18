/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration des appartements : création en lot qui ignore les doublons, renommage et
// suppression (correctif du plan 04). Base de DATABASE_URL (branche Neon dev) ; tout ce qui est créé
// est supprimé à la fin. Sans DATABASE_URL, les tests sont ignorés. La session est simulée par
// l'en-tête x-test-user : middlewares, routes et base sont réels.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { LOT_ERRORS, type Role } from '@syndic/shared';
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

describe.skipIf(!hasDatabase)('API appartements : création en lot, renommage, suppression', () => {
  const tag = `lots-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const users = ['mgrA', 'mgrB', 'treasurer', 'deputy', 'owner', 'tenant', 'caretaker'].map(uid);
  let app: (typeof import('./app'))['app'];
  let resA: string;
  let resB: string;

  const api = (userId: string, method: string, path: string, residence: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-test-user': userId, 'X-Residence-Id': residence },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const lotsOf = async (residenceId: string) =>
    (
      await getDb()
        .select({ id: schema.lot.id, reference: schema.lot.reference })
        .from(schema.lot)
        .where(eq(schema.lot.residenceId, residenceId))
    )
      .map((row) => row.reference)
      .sort();

  const addLot = async (residenceId: string, reference: string) => {
    const [row] = await getDb()
      .insert(schema.lot)
      .values({ residenceId, reference })
      .returning({ id: schema.lot.id });
    return row!.id;
  };

  const addResidence = async (name: string, members: [string, Role][]) => {
    const [row] = await getDb()
      .insert(schema.residence)
      .values({ name: `${tag} ${name}`, city: 'Casablanca' })
      .returning({ id: schema.residence.id });
    await getDb()
      .insert(schema.membership)
      .values(members.map(([userId, role]) => ({ residenceId: row!.id, userId, role })));
    return row!.id;
  };

  beforeAll(async () => {
    ({ app } = await import('./app'));
    await getDb()
      .insert(schema.user)
      .values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
    resA = await addResidence('A', [
      [uid('mgrA'), 'manager'],
      [uid('treasurer'), 'treasurer'],
      [uid('deputy'), 'deputy'],
      [uid('owner'), 'owner'],
      [uid('tenant'), 'tenant'],
      [uid('caretaker'), 'caretaker'],
    ]);
    resB = await addResidence('B', [[uid('mgrB'), 'manager']]);
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
      await db.delete(schema.issue).where(inArray(schema.issue.residenceId, ids));
      await db.delete(schema.receipt).where(inArray(schema.receipt.residenceId, ids));
      await db.delete(schema.payment).where(inArray(schema.payment.residenceId, ids));
      await db.delete(schema.chargeDue).where(inArray(schema.chargeDue.residenceId, ids));
      await db.delete(schema.chargeCall).where(inArray(schema.chargeCall.residenceId, ids));
      await db.delete(schema.invitation).where(inArray(schema.invitation.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  describe('POST /api/lots/bulk : les références existantes sont ignorées', () => {
    it('A11 à A42 existent : générer A et B crée B11 à B42 et ignore A11 à A42', async () => {
      const res = await addResidence('bulk', [[uid('mgrA'), 'manager']]);
      const body = { floorFrom: 1, floorTo: 4, perFloor: 2 };
      const first = await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, { ...body, buildings: ['A'] });
      expect(first.status).toBe(201);
      expect(await first.json()).toMatchObject({ created: 8, skipped: 0 });

      const second = await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, {
        ...body,
        buildings: ['A', 'B'],
      });
      expect(second.status).toBe(201);
      const json = (await second.json()) as any;
      expect(json).toMatchObject({ created: 8, skipped: 8 });
      expect(json.lots.map((l: { reference: string }) => l.reference)).toEqual([
        'B11', 'B12', 'B21', 'B22', 'B31', 'B32', 'B41', 'B42',
      ]);
      expect((await lotsOf(res)).length).toBe(16);
    });

    it('relancer la même génération : rien à créer, aucune erreur, aucun lot de plus', async () => {
      const res = await addResidence('bulk-again', [[uid('mgrA'), 'manager']]);
      const body = { buildings: ['A', 'B'], floorFrom: 1, floorTo: 2, perFloor: 2 };
      expect((await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, body)).status).toBe(201);
      const again = await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, body);
      expect(again.status).toBe(200);
      expect(await again.json()).toMatchObject({ created: 0, skipped: 8, lots: [] });
      expect((await lotsOf(res)).length).toBe(8);
    });

    it('un lot créé à la main est ignoré, pas dupliqué', async () => {
      const res = await addResidence('bulk-manual', [[uid('mgrA'), 'manager']]);
      await addLot(res, 'C11');
      const response = await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, {
        buildings: ['C'],
        floorFrom: 1,
        floorTo: 1,
        perFloor: 2,
      });
      expect(await response.json()).toMatchObject({ created: 1, skipped: 1 });
    });

    it('deux appels simultanés ne créent aucun doublon : créés cumulés = nombre de lots', async () => {
      const res = await addResidence('bulk-race', [[uid('mgrA'), 'manager']]);
      const body = { buildings: ['A', 'B', 'C'], floorFrom: 1, floorTo: 5, perFloor: 4 };
      const responses = await Promise.all(
        [1, 2, 3, 4].map(() => api(uid('mgrA'), 'POST', '/api/lots/bulk', res, body)),
      );
      const results = await Promise.all(responses.map((r) => r.json() as Promise<any>));
      for (const response of responses) expect(response.status).toBeLessThan(300);
      const total = body.buildings.length * 5 * 4;
      // Chaque référence est créée par un seul appel.
      expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(total);
      for (const r of results) expect(r.created + r.skipped).toBe(total);
      const refs = await lotsOf(res);
      expect(refs).toHaveLength(total);
      expect(new Set(refs).size).toBe(total);
    });

    it('tout se fait dans une transaction : un échec en cours de route ne laisse aucun lot', async () => {
      const res = await addResidence('bulk-tx', [[uid('mgrA'), 'manager']]);
      const { db } = await import('@syndic/db');
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(schema.lot).values({ residenceId: res, reference: 'T11' });
          throw new Error('annulation');
        }),
      ).rejects.toThrow('annulation');
      expect(await lotsOf(res)).toEqual([]);
    });
  });

  describe('PATCH /api/lots/:id : renommer', () => {
    it('renomme un appartement libre ; id, bâtiment et étage restent', async () => {
      const id = await addLot(resA, 'R11');
      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${id}`, resA, { reference: '  R12 ' });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id, reference: 'R12' });
      expect(await lotsOf(resA)).toContain('R12');
      expect(await lotsOf(resA)).not.toContain('R11');
    });

    it('garder la même référence est accepté', async () => {
      const id = await addLot(resA, 'R20');
      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${id}`, resA, { reference: 'R20' });
      expect(response.status).toBe(200);
    });

    it('une référence déjà prise dans la résidence : 409 avec la clé de traduction, rien ne change', async () => {
      const first = await addLot(resA, 'R31');
      await addLot(resA, 'R32');
      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${first}`, resA, { reference: 'R32' });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: LOT_ERRORS.referenceExists });
      expect(await lotsOf(resA)).toContain('R31');
    });

    it('la même référence est permise dans une autre résidence', async () => {
      await addLot(resB, 'R41');
      const id = await addLot(resA, 'R40');
      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${id}`, resA, { reference: 'R41' });
      expect(response.status).toBe(200);
    });

    it('mêmes règles de format qu’à la création : vide, trop long, champ inconnu → 400', async () => {
      const id = await addLot(resA, 'R50');
      for (const body of [{ reference: '' }, { reference: '   ' }, { reference: 'X'.repeat(21) }, {}, { reference: 'R51', floor: 3 }]) {
        expect((await api(uid('mgrA'), 'PATCH', `/api/lots/${id}`, resA, body)).status).toBe(400);
      }
      expect(await lotsOf(resA)).toContain('R50');
    });

    it('un id qui n’est pas un uuid : 400 ; un lot inconnu : 404', async () => {
      expect((await api(uid('mgrA'), 'PATCH', '/api/lots/pas-un-uuid', resA, { reference: 'Z1' })).status).toBe(400);
      const unknown = await api(uid('mgrA'), 'PATCH', `/api/lots/${randomUUID()}`, resA, { reference: 'Z1' });
      expect(unknown.status).toBe(404);
      expect(await unknown.json()).toEqual({ error: LOT_ERRORS.notFound });
    });

    it('un appartement avec membre, invitation, charge et paiement garde tous ses liens', async () => {
      const res = await addResidence('rename-links', [[uid('mgrA'), 'manager']]);
      const lotId = await addLot(res, 'L11');
      const db = getDb();
      const [member] = await db
        .insert(schema.membership)
        .values({ residenceId: res, userId: uid('owner'), role: 'owner', lotId })
        .returning({ id: schema.membership.id });
      const [invitation] = await db
        .insert(schema.invitation)
        .values({
          residenceId: res,
          lotId,
          role: 'tenant',
          code: `${tag}-i`.slice(-12),
          expiresAt: new Date(Date.now() + 86_400_000),
          createdBy: uid('mgrA'),
        })
        .returning({ id: schema.invitation.id });
      const [call] = await db
        .insert(schema.chargeCall)
        .values({ residenceId: res, periodLabel: '2026-Q4', amountPerLot: 45_000, dueDate: '2026-12-15', createdBy: uid('mgrA') })
        .returning({ id: schema.chargeCall.id });
      const [due] = await db
        .insert(schema.chargeDue)
        .values({ residenceId: res, chargeCallId: call!.id, lotId, amountDue: 45_000, amountPaid: 45_000, status: 'paid' })
        .returning({ id: schema.chargeDue.id });
      const [payment] = await db
        .insert(schema.payment)
        .values({ residenceId: res, chargeDueId: due!.id, amount: 45_000, method: 'cash', recordedBy: uid('mgrA') })
        .returning({ id: schema.payment.id });
      const [receipt] = await db
        .insert(schema.receipt)
        .values({ residenceId: res, paymentId: payment!.id, number: '2026-0001', storageKey: 'residences/x/receipts/2026/2026-0001.pdf' })
        .returning({ id: schema.receipt.id, number: schema.receipt.number, storageKey: schema.receipt.storageKey });

      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${lotId}`, res, { reference: 'L99' });
      expect(response.status).toBe(200);

      const [m] = await db.select().from(schema.membership).where(eq(schema.membership.id, member!.id));
      const [i] = await db.select().from(schema.invitation).where(eq(schema.invitation.id, invitation!.id));
      const [d] = await db.select().from(schema.chargeDue).where(eq(schema.chargeDue.id, due!.id));
      const [p] = await db.select().from(schema.payment).where(eq(schema.payment.id, payment!.id));
      const [r] = await db.select().from(schema.receipt).where(eq(schema.receipt.id, receipt!.id));
      expect([m!.lotId, i!.lotId, d!.lotId]).toEqual([lotId, lotId, lotId]);
      expect(d).toMatchObject({ amountDue: 45_000, amountPaid: 45_000, status: 'paid' });
      expect(p).toMatchObject({ amount: 45_000, cancelledAt: null });
      // Le reçu déjà émis n'est pas touché : même numéro, même fichier stocké.
      expect(r).toMatchObject({ number: receipt!.number, storageKey: receipt!.storageKey });
    });
  });

  describe('DELETE /api/lots/:id : supprimer', () => {
    const refuse = async (lotId: string, key: string, residence = resA) => {
      const response = await api(uid('mgrA'), 'DELETE', `/api/lots/${lotId}`, residence);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: key });
      const [still] = await getDb().select().from(schema.lot).where(eq(schema.lot.id, lotId));
      expect(still).toBeDefined();
    };

    it('supprime un appartement vide : 204, il disparaît de la liste', async () => {
      const id = await addLot(resA, 'D11');
      const response = await api(uid('mgrA'), 'DELETE', `/api/lots/${id}`, resA);
      expect(response.status).toBe(204);
      expect(await lotsOf(resA)).not.toContain('D11');
    });

    it('retire aussi les invitations annulées, expirées ou terminées du lot', async () => {
      const id = await addLot(resA, 'D12');
      const day = 86_400_000;
      await getDb()
        .insert(schema.invitation)
        .values([
          { residenceId: resA, lotId: id, role: 'owner', code: `${tag}-d1`.slice(-12), expiresAt: new Date(Date.now() + day), revokedAt: new Date(), createdBy: uid('mgrA') },
          { residenceId: resA, lotId: id, role: 'owner', code: `${tag}-d2`.slice(-12), expiresAt: new Date(Date.now() - day), createdBy: uid('mgrA') },
        ]);
      const response = await api(uid('mgrA'), 'DELETE', `/api/lots/${id}`, resA);
      expect(response.status).toBe(204);
      const left = await getDb().select({ n: count() }).from(schema.invitation).where(eq(schema.invitation.lotId, id));
      expect(left[0]!.n).toBe(0);
    });

    it('refuse si un membre est rattaché (409 hasMember)', async () => {
      const id = await addLot(resA, 'D21');
      await getDb().insert(schema.membership).values({ residenceId: resA, userId: uid('owner'), role: 'owner', lotId: id });
      await refuse(id, LOT_ERRORS.hasMember);
    });

    it('refuse aussi si le membre est parti (son historique reste rattaché)', async () => {
      const id = await addLot(resA, 'D22');
      await getDb()
        .insert(schema.membership)
        .values({ residenceId: resA, userId: uid('tenant'), role: 'tenant', lotId: id, active: false, endedAt: new Date() });
      await refuse(id, LOT_ERRORS.hasMember);
    });

    it('refuse si une invitation est en cours (409 hasInvitation)', async () => {
      const id = await addLot(resA, 'D31');
      await getDb().insert(schema.invitation).values({
        residenceId: resA,
        lotId: id,
        role: 'owner',
        code: `${tag}-d3`.slice(-12),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: uid('mgrA'),
      });
      await refuse(id, LOT_ERRORS.hasInvitation);
    });

    const addDue = async (residence: string, lotId: string, period: string) => {
      const db = getDb();
      const [call] = await db
        .insert(schema.chargeCall)
        .values({ residenceId: residence, periodLabel: period, amountPerLot: 45_000, dueDate: '2026-12-15', createdBy: uid('mgrA') })
        .returning({ id: schema.chargeCall.id });
      const [due] = await db
        .insert(schema.chargeDue)
        .values({ residenceId: residence, chargeCallId: call!.id, lotId, amountDue: 45_000 })
        .returning({ id: schema.chargeDue.id });
      return due!.id;
    };

    it('refuse si une charge existe (409 hasCharges)', async () => {
      const id = await addLot(resA, 'D41');
      await addDue(resA, id, '2026-Q1');
      await refuse(id, LOT_ERRORS.hasCharges);
    });

    it('refuse si un paiement existe, même annulé (409 hasPayments)', async () => {
      const id = await addLot(resA, 'D51');
      const dueId = await addDue(resA, id, '2026-Q2');
      await getDb().insert(schema.payment).values({
        residenceId: resA,
        chargeDueId: dueId,
        amount: 10_000,
        method: 'cash',
        recordedBy: uid('mgrA'),
        cancelledAt: new Date(),
        cancelledBy: uid('mgrA'),
        cancelReason: 'erreur',
      });
      await refuse(id, LOT_ERRORS.hasPayments);
    });

    it('refuse si un signalement vise le lot (409 hasIssues) au lieu d’une erreur serveur', async () => {
      const id = await addLot(resA, 'D61');
      await getDb().insert(schema.issue).values({
        residenceId: resA,
        authorId: uid('owner'),
        authorLotId: id,
        title: 'Fuite',
        location: 'elevator',
      } as typeof schema.issue.$inferInsert);
      await refuse(id, LOT_ERRORS.hasIssues);
    });

    it('un lot inconnu ou un id invalide : 404 / 400', async () => {
      expect((await api(uid('mgrA'), 'DELETE', `/api/lots/${randomUUID()}`, resA)).status).toBe(404);
      expect((await api(uid('mgrA'), 'DELETE', '/api/lots/xyz', resA)).status).toBe(400);
    });

    it('GET /lots donne la raison de blocage de chaque lot (deleteBlocker)', async () => {
      const res = await addResidence('blockers', [[uid('mgrA'), 'manager']]);
      const [free, member, charge] = await Promise.all(['K1', 'K2', 'K3'].map((r) => addLot(res, r)));
      await getDb().insert(schema.membership).values({ residenceId: res, userId: uid('owner'), role: 'owner', lotId: member! });
      await addDue(res, charge!, '2026-Q3');
      const list = (await (await api(uid('mgrA'), 'GET', '/api/lots', res)).json()) as any;
      const blocker = Object.fromEntries(list.lots.map((l: any) => [l.reference, l.deleteBlocker]));
      expect(blocker).toEqual({ K1: null, K2: 'member', K3: 'charge' });
      expect(free).toBeDefined();
    });
  });

  describe('bâtiment de l’appartement', () => {
    const buildingsOf = async (residence: string, user = 'mgrA') => {
      const list = (await (await api(uid(user), 'GET', '/api/lots', residence)).json()) as any;
      return Object.fromEntries(list.lots.map((l: any) => [l.reference, l.building]));
    };

    it('la génération rapide enregistre le bâtiment et l’étage, et la liste les renvoie', async () => {
      const res = await addResidence('building-bulk', [[uid('mgrA'), 'manager']]);
      const response = await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, {
        buildings: ['a', 'B'],
        floorFrom: 1,
        floorTo: 2,
        perFloor: 1,
      });
      expect(response.status).toBe(201);
      expect(await buildingsOf(res)).toEqual({ A11: 'A', A21: 'A', B11: 'B', B21: 'B' });
      const list = (await (await api(uid('mgrA'), 'GET', '/api/lots', res)).json()) as any;
      expect(list.lots.find((l: any) => l.reference === 'B21')).toMatchObject({ building: 'B', floor: 2 });
    });

    it('« Un par un » enregistre le bâtiment choisi (en majuscules) ou aucun', async () => {
      const res = await addResidence('building-single', [[uid('mgrA'), 'manager']]);
      expect((await api(uid('mgrA'), 'POST', '/api/lots', res, { reference: 'X1', building: 'b2' })).status).toBe(201);
      expect((await api(uid('mgrA'), 'POST', '/api/lots', res, { reference: 'X2' })).status).toBe(201);
      expect((await api(uid('mgrA'), 'POST', '/api/lots', res, { reference: 'X3', building: '  ' })).status).toBe(201);
      expect(await buildingsOf(res)).toEqual({ X1: 'B2', X2: null, X3: null });
    });

    it('renommer garde le bâtiment et l’étage', async () => {
      const res = await addResidence('building-rename', [[uid('mgrA'), 'manager']]);
      await api(uid('mgrA'), 'POST', '/api/lots/bulk', res, { buildings: ['A'], floorFrom: 1, floorTo: 1, perFloor: 1 });
      const [lot] = await getDb().select().from(schema.lot).where(eq(schema.lot.residenceId, res));
      const response = await api(uid('mgrA'), 'PATCH', `/api/lots/${lot!.id}`, res, { reference: 'Z99' });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ reference: 'Z99', building: 'A', floor: 1 });
    });

    it('isolation : la liste de B ne contient jamais les bâtiments de A', async () => {
      const resC = await addResidence('building-iso-a', [[uid('mgrA'), 'manager']]);
      const resD = await addResidence('building-iso-b', [[uid('mgrB'), 'manager']]);
      await api(uid('mgrA'), 'POST', '/api/lots', resC, { reference: 'SECRET1', building: 'ZZ' });
      await api(uid('mgrB'), 'POST', '/api/lots', resD, { reference: 'OTHER1', building: 'YY' });
      expect(await buildingsOf(resD, 'mgrB')).toEqual({ OTHER1: 'YY' });
      expect(await buildingsOf(resC)).toEqual({ SECRET1: 'ZZ' });
      // Lire la liste de A avec l'en-tête de B est refusé.
      expect((await api(uid('mgrB'), 'GET', '/api/lots', resC)).status).toBe(403);
    });
  });

  describe('isolation et permissions', () => {
    it('le syndic de A ne peut ni renommer ni supprimer un lot de B (403 avec B, 404 avec A)', async () => {
      const lotB = await addLot(resB, 'ISO1');
      for (const [method, body] of [['PATCH', { reference: 'HACK' }], ['DELETE', undefined]] as const) {
        const withB = await api(uid('mgrA'), method, `/api/lots/${lotB}`, resB, body);
        expect(withB.status).toBe(403);
        // Avec sa propre résidence, le lot de B est introuvable : filtre sur residence_id.
        const withA = await api(uid('mgrA'), method, `/api/lots/${lotB}`, resA, body);
        expect(withA.status).toBe(404);
      }
      const [still] = await getDb().select().from(schema.lot).where(eq(schema.lot.id, lotB));
      expect(still!.reference).toBe('ISO1');
    });

    it('la génération en lot de B ne touche pas A, et inversement', async () => {
      const before = (await lotsOf(resA)).length;
      const response = await api(uid('mgrB'), 'POST', '/api/lots/bulk', resB, { buildings: ['Q'], floorFrom: 1, floorTo: 1, perFloor: 3 });
      expect(response.status).toBe(201);
      expect((await lotsOf(resA)).length).toBe(before);
      expect((await api(uid('mgrB'), 'POST', '/api/lots/bulk', resA, { buildings: ['Q'], floorFrom: 1, floorTo: 1, perFloor: 3 })).status).toBe(403);
    });

    it.each(['treasurer', 'deputy', 'owner', 'tenant', 'caretaker'])(
      '%s (sans lots.write) reçoit 403 sur POST /bulk, PATCH et DELETE, et rien ne change',
      async (name) => {
        const id = await addLot(resA, `P-${name}`.slice(0, 20));
        const before = await lotsOf(resA);
        const bulk = await api(uid(name), 'POST', '/api/lots/bulk', resA, { buildings: ['W'], floorFrom: 1, floorTo: 1, perFloor: 1 });
        const patch = await api(uid(name), 'PATCH', `/api/lots/${id}`, resA, { reference: 'HACK' });
        const del = await api(uid(name), 'DELETE', `/api/lots/${id}`, resA);
        expect([bulk.status, patch.status, del.status]).toEqual([403, 403, 403]);
        expect(await lotsOf(resA)).toEqual(before);
      },
    );

    it('sans session : 401', async () => {
      const id = await addLot(resA, 'NOSESS');
      for (const method of ['PATCH', 'DELETE']) {
        const response = await app.request(`/api/lots/${id}`, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-Residence-Id': resA },
          body: method === 'PATCH' ? JSON.stringify({ reference: 'X' }) : undefined,
        });
        expect(response.status).toBe(401);
      }
    });

    it('le lot est supprimé uniquement dans la résidence active (filtre residence_id)', async () => {
      const keep = await addLot(resB, 'SAME1');
      const mine = await addLot(resA, 'SAME1');
      expect((await api(uid('mgrA'), 'DELETE', `/api/lots/${mine}`, resA)).status).toBe(204);
      const [other] = await getDb()
        .select()
        .from(schema.lot)
        .where(and(eq(schema.lot.id, keep), eq(schema.lot.residenceId, resB)));
      expect(other).toBeDefined();
    });
  });
});
