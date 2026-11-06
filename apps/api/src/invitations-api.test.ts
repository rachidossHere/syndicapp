/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration de l'API des invitations (plan 04, étape 3).
// Base de DATABASE_URL (branche Neon dev en local, AGENTS.md) ; toutes les données créées sont
// supprimées à la fin. Sans DATABASE_URL, les tests sont ignorés. La session est simulée par
// l'en-tête x-test-user ; middlewares, routes et base sont réels.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { INVITATION_ERRORS, type Role } from '@syndic/shared';
import { and, count, eq, inArray, like } from 'drizzle-orm';
import { generateInviteCode } from './services/invitations';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe.skipIf(!hasDatabase)('API des invitations', () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const users = [
    'mgrA',
    'mgrB',
    'owner',
    'tenant',
    'caretaker',
    'newbie',
    'newbie2',
    'newbie3',
    'racer1',
    'racer2',
    'racer3',
    'racer4',
    'spammer',
  ].map(uid);
  let app: (typeof import('./app'))['app'];
  let resetAttempts: () => void;
  let resA: string;
  let resB: string;
  let lotA1: string;
  let lotA2: string;
  let lotB1: string;

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

  /** Crée une invitation en base ; le code est fixe pour pouvoir tester les cas limites. */
  const insertInvitation = async (
    values: Partial<typeof schema.invitation.$inferInsert> & { role: Role },
  ) => {
    const code = generateInviteCode();
    const [row] = await getDb()
      .insert(schema.invitation)
      .values({
        residenceId: resA,
        code,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: uid('mgrA'),
        ...values,
      })
      .returning();
    return row!;
  };

  const memberships = async (userId: string, residenceId: string) =>
    getDb()
      .select()
      .from(schema.membership)
      .where(
        and(eq(schema.membership.userId, userId), eq(schema.membership.residenceId, residenceId)),
      );

  beforeAll(async () => {
    ({ app } = await import('./app'));
    ({
      inviteAttempts: { reset: resetAttempts },
    } = await import('./rate-limit'));
    const db = getDb();
    await db
      .insert(schema.user)
      .values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
    const addResidence = async (name: string, members: [string, Role][]) => {
      const [row] = await db
        .insert(schema.residence)
        .values({ name: `${tag} ${name}`, city: 'Casablanca' })
        .returning({ id: schema.residence.id });
      await db
        .insert(schema.membership)
        .values(members.map(([userId, role]) => ({ residenceId: row!.id, userId, role })));
      return row!.id;
    };
    resA = await addResidence('A', [
      [uid('mgrA'), 'manager'],
      [uid('owner'), 'owner'],
      [uid('tenant'), 'tenant'],
      [uid('caretaker'), 'caretaker'],
    ]);
    resB = await addResidence('B', [[uid('mgrB'), 'manager']]);
    const addLot = async (residenceId: string, reference: string) => {
      const [row] = await db
        .insert(schema.lot)
        .values({ residenceId, reference })
        .returning({ id: schema.lot.id });
      return row!.id;
    };
    lotA1 = await addLot(resA, 'A11');
    lotA2 = await addLot(resA, 'A12');
    lotB1 = await addLot(resB, 'B11');
  });

  beforeEach(() => resetAttempts());

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

  describe('création', () => {
    it('un manager crée une invitation : code, lien, expiration à 7 jours', async () => {
      const res = await api(uid('mgrA'), 'POST', '/api/invitations', {
        residence: resA,
        body: { role: 'owner', lotId: lotA1 },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.code).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
      expect(body.link).toBe(`syndicapp://invite/${body.code}`);
      expect(body.role).toBe('owner');
      const days = (new Date(body.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThanOrEqual(7);
    });

    it.each(['owner', 'tenant', 'caretaker'] as const)(
      '%s ne peut pas inviter (403)',
      async (who) => {
        const res = await api(uid(who), 'POST', '/api/invitations', {
          residence: resA,
          body: { role: 'owner', lotId: lotA1 },
        });
        expect(res.status).toBe(403);
        const list = await api(uid(who), 'GET', '/api/invitations', { residence: resA });
        expect(list.status).toBe(403);
      },
    );

    it('refuse le rôle manager (400)', async () => {
      const res = await api(uid('mgrA'), 'POST', '/api/invitations', {
        residence: resA,
        body: { role: 'manager', lotId: lotA1 },
      });
      expect(res.status).toBe(400);
    });

    it("refuse un lot d'une autre résidence ou inexistant", async () => {
      const other = await api(uid('mgrA'), 'POST', '/api/invitations', {
        residence: resA,
        body: { role: 'owner', lotId: lotB1 },
      });
      expect(other.status).toBe(400);
      expect(await other.json()).toEqual({ error: INVITATION_ERRORS.lotNotFound });
      const missing = await api(uid('mgrA'), 'POST', '/api/invitations', {
        residence: resA,
        body: { role: 'owner', lotId: '0b6f5f4e-6d0f-4c1c-8f43-3d6c1a0f7a11' },
      });
      expect(await missing.json()).toEqual({ error: INVITATION_ERRORS.lotNotFound });
      const [{ n }] = await getDb()
        .select({ n: count() })
        .from(schema.invitation)
        .where(eq(schema.invitation.lotId, lotB1));
      expect(n).toBe(0);
    });

    it('401 sans session', async () => {
      expect((await api(null, 'POST', '/api/invitations', { residence: resA })).status).toBe(401);
      expect((await api(null, 'GET', '/api/invitations/preview/ABCDEF')).status).toBe(401);
      expect((await api(null, 'POST', '/api/invitations/accept/ABCDEF')).status).toBe(401);
    });
  });

  describe('aperçu', () => {
    it('ne contient aucun nom ni e-mail de personne', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA1 });
      const res = await api(uid('newbie'), 'GET', `/api/invitations/preview/${inv.code}`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({
        residence: { name: `${tag} A`, city: 'Casablanca' },
        lotReference: 'A11',
        role: 'owner',
        expiresAt: inv.expiresAt.toISOString(),
      });
      expect(text).not.toContain(tag + '-');
      expect(text).not.toContain('@');
    });

    it('accepte une saisie en minuscules avec espaces et tirets', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA1 });
      const typed = `${inv.code.slice(0, 3)}-${inv.code.slice(3)} `.toLowerCase();
      const res = await api(
        uid('newbie'),
        'GET',
        `/api/invitations/preview/${encodeURIComponent(typed)}`,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('acceptation', () => {
    it('crée le membership avec le bon rôle et le bon lot', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA2 });
      const res = await api(uid('newbie'), 'POST', `/api/invitations/accept/${inv.code}`);
      expect(res.status).toBe(201);
      const rows = await memberships(uid('newbie'), resA);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ role: 'owner', lotId: lotA2, active: true });
      const [after] = await getDb()
        .select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, inv.id));
      expect(after!.usedBy).toBe(uid('newbie'));
      expect(after!.usedAt).not.toBeNull();
    });

    it('plusieurs owners sur un même lot sont autorisés', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA2 });
      const res = await api(uid('newbie2'), 'POST', `/api/invitations/accept/${inv.code}`);
      expect(res.status).toBe(201);
    });

    it.each([
      ['expiré', INVITATION_ERRORS.expired, 410, { expiresAt: new Date(Date.now() - 1000) }],
      ['annulé', INVITATION_ERRORS.revoked, 410, { revokedAt: new Date() }],
    ] as const)('code %s : %s', async (_label, key, status, extra) => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA1, ...extra });
      for (const [method, path] of [
        ['POST', `/api/invitations/accept/${inv.code}`],
        ['GET', `/api/invitations/preview/${inv.code}`],
      ] as const) {
        const res = await api(uid('newbie3'), method, path);
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ error: key });
      }
      expect(await memberships(uid('newbie3'), resA)).toHaveLength(0);
    });

    it('code déjà utilisé : used', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA1 });
      expect(
        (await api(uid('newbie3'), 'POST', `/api/invitations/accept/${inv.code}`)).status,
      ).toBe(201);
      const second = await api(uid('racer1'), 'POST', `/api/invitations/accept/${inv.code}`);
      expect(second.status).toBe(410);
      expect(await second.json()).toEqual({ error: INVITATION_ERRORS.used });
      expect(await memberships(uid('racer1'), resA)).toHaveLength(0);
    });

    it('code inconnu ou mal formé : notFound', async () => {
      for (const code of ['ZZZZZZ', 'abc', 'OOOOOO']) {
        const res = await api(uid('racer1'), 'POST', `/api/invitations/accept/${code}`);
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: INVITATION_ERRORS.notFound });
      }
    });

    it('déjà membre actif : 409 alreadyMember, invitation non consommée', async () => {
      const inv = await insertInvitation({ role: 'owner', lotId: lotA1 });
      const res = await api(uid('owner'), 'POST', `/api/invitations/accept/${inv.code}`);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: INVITATION_ERRORS.alreadyMember });
      const [after] = await getDb()
        .select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, inv.id));
      expect(after!.usedAt).toBeNull();
    });

    it('second locataire sur un lot : 409 lotHasTenant', async () => {
      // lotA1 n'a pas encore de locataire : le premier passe, le second est refusé.
      const first = await insertInvitation({ role: 'tenant', lotId: lotA1 });
      const second = await insertInvitation({ role: 'tenant', lotId: lotA1 });
      const ok = await api(uid('racer1'), 'POST', `/api/invitations/accept/${first.code}`);
      expect(ok.status).toBe(201);
      const refused = await api(uid('racer2'), 'POST', `/api/invitations/accept/${second.code}`);
      expect(refused.status).toBe(409);
      expect(await refused.json()).toEqual({ error: INVITATION_ERRORS.lotHasTenant });
      expect(await memberships(uid('racer2'), resA)).toHaveLength(0);
      const [after] = await getDb()
        .select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, second.id));
      expect(after!.usedAt).toBeNull();
    });

    it('deux acceptations simultanées du même code : un seul membership', async () => {
      const inv = await insertInvitation({ role: 'caretaker' });
      const [a, b] = await Promise.all([
        api(uid('racer3'), 'POST', `/api/invitations/accept/${inv.code}`),
        api(uid('racer4'), 'POST', `/api/invitations/accept/${inv.code}`),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 410]);
      const winners = await getDb()
        .select()
        .from(schema.membership)
        .where(
          and(
            eq(schema.membership.residenceId, resA),
            inArray(schema.membership.userId, [uid('racer3'), uid('racer4')]),
            eq(schema.membership.role, 'caretaker'),
          ),
        );
      expect(winners).toHaveLength(1);
    });
  });

  describe('annulation, liste et isolation', () => {
    it('le manager liste et annule ; un code annulé disparaît de la liste', async () => {
      const created = (await (
        await api(uid('mgrA'), 'POST', '/api/invitations', {
          residence: resA,
          body: { role: 'deputy' },
        })
      ).json()) as any;
      const list = (await (
        await api(uid('mgrA'), 'GET', '/api/invitations', { residence: resA })
      ).json()) as any;
      expect(list.invitations.map((i: any) => i.id)).toContain(created.id);

      const del = await api(uid('mgrA'), 'DELETE', `/api/invitations/${created.id}`, {
        residence: resA,
      });
      expect(del.status).toBe(204);
      const after = (await (
        await api(uid('mgrA'), 'GET', '/api/invitations', { residence: resA })
      ).json()) as any;
      expect(after.invitations.map((i: any) => i.id)).not.toContain(created.id);
      const accept = await api(uid('newbie3'), 'POST', `/api/invitations/accept/${created.code}`);
      expect(await accept.json()).toEqual({ error: INVITATION_ERRORS.revoked });
    });

    it('un manager de A ne peut ni lister ni annuler les invitations de B', async () => {
      const invB = await insertInvitation({
        residenceId: resB,
        role: 'owner',
        lotId: lotB1,
        createdBy: uid('mgrB'),
      });

      // Liste : avec l'en-tête de B, refusé ; avec celui de A, aucune invitation de B.
      expect((await api(uid('mgrA'), 'GET', '/api/invitations', { residence: resB })).status).toBe(
        403,
      );
      const own = (await (
        await api(uid('mgrA'), 'GET', '/api/invitations', { residence: resA })
      ).json()) as any;
      expect(own.invitations.map((i: any) => i.id)).not.toContain(invB.id);

      // Annulation : en-tête de B refusé (403), en-tête de A : 404 comme si elle n'existait pas.
      expect(
        (await api(uid('mgrA'), 'DELETE', `/api/invitations/${invB.id}`, { residence: resB }))
          .status,
      ).toBe(403);
      expect(
        (await api(uid('mgrA'), 'DELETE', `/api/invitations/${invB.id}`, { residence: resA }))
          .status,
      ).toBe(404);
      const [after] = await getDb()
        .select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, invB.id));
      expect(after!.revokedAt).toBeNull();
    });
  });

  describe('limitation des tentatives', () => {
    it('11 tentatives en une minute : la 11e reçoit 429 (aperçu et acceptation partagent le compteur)', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const method = i % 2 === 0 ? 'GET' : 'POST';
        const prefix = method === 'GET' ? 'preview' : 'accept';
        const res = await api(
          uid('spammer'),
          method,
          `/api/invitations/${prefix}/ZZZZZ${(i % 9) + 2}`,
        );
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
      expect(statuses[10]).toBe(429);
    });

    it("un autre utilisateur n'est pas bloqué", async () => {
      for (let i = 0; i < 11; i++) {
        await api(uid('spammer'), 'GET', '/api/invitations/preview/ZZZZZZ');
      }
      const res = await api(uid('racer3'), 'GET', '/api/invitations/preview/ZZZZZZ');
      expect(res.status).toBe(404);
    });
  });
});
