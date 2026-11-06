/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration de l'API des résidences et des lots (plan 04, étape 2).
// Utilisent la base de DATABASE_URL (branche Neon dev en local, AGENTS.md) ; toutes les données
// créées sont supprimées à la fin. Sans DATABASE_URL (CI sans base), les tests sont ignorés.
// La session est simulée par l'en-tête x-test-user : tout le reste (middlewares, routes, base) est réel.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import type { Role } from '@syndic/shared';
import { count, eq, inArray, like } from 'drizzle-orm';
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

describe.skipIf(!hasDatabase)('API résidences et lots', () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const users = ['mgrA', 'mgrB', 'owner', 'tenant', 'caretaker', 'outsider', 'solo'].map(uid);
  let app: (typeof import('./app'))['app'];
  let resA: string;
  let resB: string;

  const api = (
    userId: string | null,
    method: string,
    path: string,
    options: { residence?: string; body?: unknown } = {},
  ) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-test-user'] = userId;
    if (options.residence) headers['X-Residence-Id'] = options.residence;
    return app.request(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  const lotCount = async (residenceId: string) => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(schema.lot)
      .where(eq(schema.lot.residenceId, residenceId));
    return row!.n;
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
      [uid('owner'), 'owner'],
      [uid('tenant'), 'tenant'],
      [uid('caretaker'), 'caretaker'],
    ]);
    resB = await addResidence('B', [[uid('mgrB'), 'manager']]);
  });

  afterAll(async () => {
    const db = getDb();
    const rows = await db
      .select({ id: schema.residence.id })
      .from(schema.residence)
      .where(like(schema.residence.name, `${tag}%`));
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(schema.invitation).where(inArray(schema.invitation.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  describe('middlewares', () => {
    it('401 sans session', async () => {
      expect((await api(null, 'GET', '/api/lots', { residence: resA })).status).toBe(401);
      expect((await api(null, 'GET', '/api/residences')).status).toBe(401);
    });

    it("400 si X-Residence-Id manque ou n'est pas un uuid", async () => {
      expect((await api(uid('mgrA'), 'GET', '/api/lots')).status).toBe(400);
      expect(
        (await api(uid('mgrA'), 'GET', '/api/lots', { residence: 'pas-un-uuid' })).status,
      ).toBe(400);
    });
  });

  describe('isolation entre résidences', () => {
    const nonexistent = randomUUID();
    const bulkBody = { buildings: ['Z'], floorFrom: 1, floorTo: 1, perFloor: 1 };
    const routes: [string, string, unknown?][] = [
      ['GET', '/api/residences/current'],
      ['GET', '/api/lots'],
      ['POST', '/api/lots', { reference: 'ZZ1' }],
      ['POST', '/api/lots/bulk', bulkBody],
    ];

    it.each(routes)('%s %s : A ne peut rien lire ni écrire dans B', async (method, path, body) => {
      const [lotsBefore, lotsBeforeA] = [await lotCount(resB), await lotCount(resA)];
      const intoB = await api(uid('mgrA'), method, path, { residence: resB, body });
      const intoNowhere = await api(uid('mgrA'), method, path, { residence: nonexistent, body });

      expect(intoB.status).toBe(403);
      expect(await intoB.json() as any).toEqual({ error: 'forbidden' });
      // Réponse identique à celle d'une résidence inexistante : on ne révèle pas qu'elle existe.
      expect(intoNowhere.status).toBe(intoB.status);
      expect(await intoNowhere.json() as any).toEqual({ error: 'forbidden' });
      expect(await lotCount(resB)).toBe(lotsBefore);
      expect(await lotCount(resA)).toBe(lotsBeforeA);
    });

    it.each(routes)('%s %s : B ne peut rien lire ni écrire dans A', async (method, path, body) => {
      const before = await lotCount(resA);
      const response = await api(uid('mgrB'), method, path, { residence: resA, body });
      expect(response.status).toBe(403);
      expect(await response.json() as any).toEqual({ error: 'forbidden' });
      expect(await lotCount(resA)).toBe(before);
    });

    it('un utilisateur sans aucune résidence reçoit 403 partout', async () => {
      for (const [method, path, body] of routes) {
        const response = await api(uid('outsider'), method, path, { residence: resA, body });
        expect(response.status).toBe(403);
      }
    });

    it("la résidence vient de l'en-tête, jamais du corps de la requête", async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/lots', {
        residence: resA,
        body: { reference: 'INJ1', residenceId: resB, residence_id: resB },
      });
      expect(response.status).toBe(201);
      const rows = await getDb()
        .select({ residenceId: schema.lot.residenceId })
        .from(schema.lot)
        .where(eq(schema.lot.reference, 'INJ1'));
      expect(rows.filter((row) => row.residenceId === resB)).toEqual([]);
      expect(rows.some((row) => row.residenceId === resA)).toBe(true);
    });

    it('un membership inactif ne donne aucun accès', async () => {
      const gone = await addResidence('gone', [[uid('mgrB'), 'manager']]);
      await getDb()
        .update(schema.membership)
        .set({ active: false, endedAt: new Date() })
        .where(eq(schema.membership.residenceId, gone));
      const response = await api(uid('mgrB'), 'GET', '/api/lots', { residence: gone });
      expect(response.status).toBe(403);
    });

    it('GET /api/residences ne liste que mes résidences, avec mon rôle', async () => {
      const mine = await (await api(uid('mgrA'), 'GET', '/api/residences')).json() as any;
      expect(mine.residences.map((r: { id: string }) => r.id)).toEqual([resA]);
      expect(mine.residences[0].role).toBe('manager');
      const owner = await (await api(uid('owner'), 'GET', '/api/residences')).json() as any;
      expect(owner.residences.map((r: { role: string }) => r.role)).toEqual(['owner']);
    });

    it('GET /api/residences/current renvoie la résidence et mon rôle', async () => {
      const response = await api(uid('tenant'), 'GET', '/api/residences/current', {
        residence: resA,
      });
      expect(response.status).toBe(200);
      expect(await response.json() as any).toMatchObject({ id: resA, role: 'tenant' });
    });
  });

  describe('permissions', () => {
    it.each(['owner', 'tenant', 'caretaker'])(
      '%s reçoit 403 sur POST /lots et /lots/bulk',
      async (name) => {
        const before = await lotCount(resA);
        const single = await api(uid(name), 'POST', '/api/lots', {
          residence: resA,
          body: { reference: 'X1' },
        });
        const bulk = await api(uid(name), 'POST', '/api/lots/bulk', {
          residence: resA,
          body: { buildings: ['X'], floorFrom: 1, floorTo: 1, perFloor: 1 },
        });
        expect(single.status).toBe(403);
        expect(bulk.status).toBe(403);
        expect(await lotCount(resA)).toBe(before);
      },
    );

    it('tout membre peut lire la liste des lots', async () => {
      for (const name of ['owner', 'tenant', 'caretaker']) {
        expect((await api(uid(name), 'GET', '/api/lots', { residence: resA })).status).toBe(200);
      }
    });

    it('le syndic crée un lot ; une référence en double donne 409', async () => {
      const body = { reference: 'D1', building: 'D', floor: 1 };
      const first = await api(uid('mgrA'), 'POST', '/api/lots', { residence: resA, body });
      expect(first.status).toBe(201);
      const second = await api(uid('mgrA'), 'POST', '/api/lots', { residence: resA, body });
      expect(second.status).toBe(409);
      expect(await second.json() as any).toEqual({ error: 'conflict', references: ['D1'] });
    });

    it('entrée invalide : 400', async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/lots', {
        residence: resA,
        body: { reference: '' },
      });
      expect(response.status).toBe(400);
    });
  });

  describe('génération rapide', () => {
    const body = { buildings: ['A', 'B'], floorFrom: 1, floorTo: 4, perFloor: 3 };

    it('A et B, étages 1 à 4, 3 par étage : 24 lots aux bonnes références', async () => {
      const response = await api(uid('mgrB'), 'POST', '/api/lots/bulk', { residence: resB, body });
      expect(response.status).toBe(201);
      const json = await response.json() as any;
      expect(json.count).toBe(24);

      const list = await (await api(uid('mgrB'), 'GET', '/api/lots', { residence: resB })).json() as any;
      const refs: string[] = list.lots.map((l: { reference: string }) => l.reference);
      expect(refs).toHaveLength(24);
      expect(refs.slice(0, 3)).toEqual(['A11', 'A12', 'A13']);
      expect(refs).toContain('B43');
      expect(refs.at(-1)).toBe('B43');
      expect(list.lots[0]).toMatchObject({
        building: 'A',
        floor: 1,
        type: 'apartment',
        status: 'free',
      });
    });

    it('un second appel identique : 409 sans création partielle', async () => {
      const response = await api(uid('mgrB'), 'POST', '/api/lots/bulk', { residence: resB, body });
      expect(response.status).toBe(409);
      const json = await response.json() as any;
      expect(json.error).toBe('conflict');
      expect(json.references).toHaveLength(24);
      expect(await lotCount(resB)).toBe(24);
    });

    it('un conflit partiel annule tout : aucun lot du bâtiment C créé', async () => {
      const response = await api(uid('mgrB'), 'POST', '/api/lots/bulk', {
        residence: resB,
        body: { buildings: ['A', 'C'], floorFrom: 1, floorTo: 1, perFloor: 1 },
      });
      expect(response.status).toBe(409);
      expect((await response.json() as any).references).toEqual(['A11']);
      expect(await lotCount(resB)).toBe(24);
    });

    it('les mêmes références sont permises dans une autre résidence', async () => {
      const response = await api(uid('mgrA'), 'POST', '/api/lots/bulk', { residence: resA, body });
      expect(response.status).toBe(201);
    });

    it('plus de 500 lots : 400', async () => {
      // 5 bâtiments x 101 étages x 1 = 505 lots.
      const response = await api(uid('mgrA'), 'POST', '/api/lots/bulk', {
        residence: resA,
        body: { buildings: ['E', 'F', 'G', 'H', 'I'], floorFrom: 0, floorTo: 100, perFloor: 1 },
      });
      expect(response.status).toBe(400);
      expect(await response.json() as any).toEqual({ error: 'bad_request' });
    });
  });

  describe('statut des lots', () => {
    it('member, pending, free', async () => {
      const resS = await addResidence('status', [[uid('mgrB'), 'manager']]);
      const db = getDb();
      const created = await db
        .insert(schema.lot)
        .values(
          ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((reference) => ({
            residenceId: resS,
            reference,
          })),
        )
        .returning({ id: schema.lot.id, reference: schema.lot.reference });
      const lotId = (ref: string) => created.find((l) => l.reference === ref)!.id;
      await db
        .insert(schema.membership)
        .values({ residenceId: resS, userId: uid('owner'), role: 'owner', lotId: lotId('S1') });
      const day = 86_400_000;
      const invite = (ref: string, extra: Partial<typeof schema.invitation.$inferInsert>) => ({
        residenceId: resS,
        lotId: lotId(ref),
        role: 'owner' as const,
        code: `${tag}-${ref}`.slice(-12),
        expiresAt: new Date(Date.now() + day),
        createdBy: uid('mgrB'),
        ...extra,
      });
      await db
        .insert(schema.invitation)
        .values([
          invite('S2', {}),
          invite('S3', { expiresAt: new Date(Date.now() - day) }),
          invite('S4', { revokedAt: new Date() }),
          invite('S5', { usedAt: new Date(), usedBy: uid('tenant') }),
        ]);

      const list = await (await api(uid('mgrB'), 'GET', '/api/lots', { residence: resS })).json() as any;
      const status = Object.fromEntries(
        list.lots.map((l: { reference: string; status: string }) => [l.reference, l.status]),
      );
      expect(status).toEqual({
        S1: 'member',
        S2: 'pending',
        S3: 'free',
        S4: 'free',
        S5: 'free',
        S6: 'free',
      });
    });
  });

  describe('POST /api/residences', () => {
    it('crée la résidence et le membership manager ensemble', async () => {
      const response = await api(uid('solo'), 'POST', '/api/residences', {
        body: { name: `${tag} Nouvelle`, city: 'Rabat', address: '  ' },
      });
      expect(response.status).toBe(201);
      const json = await response.json() as any;
      expect(json).toMatchObject({ name: `${tag} Nouvelle`, city: 'Rabat', role: 'manager' });

      const members = await getDb()
        .select({
          userId: schema.membership.userId,
          role: schema.membership.role,
          active: schema.membership.active,
        })
        .from(schema.membership)
        .where(eq(schema.membership.residenceId, json.id));
      expect(members).toEqual([{ userId: uid('solo'), role: 'manager', active: true }]);

      const mine = await (await api(uid('solo'), 'GET', '/api/residences')).json() as any;
      expect(mine.residences.map((r: { id: string }) => r.id)).toEqual([json.id]);
    });

    it('entrée invalide : 400 et rien de créé', async () => {
      const response = await api(uid('solo'), 'POST', '/api/residences', { body: { name: '' } });
      expect(response.status).toBe(400);
    });

    it('transaction : si le membership échoue, la résidence est annulée', async () => {
      const { createResidenceWithManager } = await import('./services/residences');
      const name = `${tag} Annulée`;
      // Utilisateur inexistant : la clé étrangère du membership échoue après l'insertion de la résidence.
      await expect(
        createResidenceWithManager(uid('fantome'), { name, city: 'Fès' }),
      ).rejects.toBeDefined();
      const rows = await getDb()
        .select({ id: schema.residence.id })
        .from(schema.residence)
        .where(eq(schema.residence.name, name));
      expect(rows).toEqual([]);
    });
  });
});
