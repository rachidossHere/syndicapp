/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration des annonces (plan 08, étape 3) : base de DATABASE_URL (branche Neon dev),
// expo-server-sdk SIMULÉ (aucun envoi réel). Tout ce qui est créé (lignes, comptes de test) est
// supprimé à la fin ; les données réelles (comptes Rachidoss et Testmest, résidences Al Andalous et
// « Résidence test ») ne sont jamais lues ni modifiées : tout est rangé sous une étiquette aléatoire.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_ERRORS,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  type Role,
} from '@syndic/shared';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setPushClientForTests, type PushClient } from './notify/client';
import { notificationText } from './notify/texts';

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
const configured = Boolean(process.env.DATABASE_URL);

const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!configured)('annonces (Expo simulé)', { timeout: 300_000 }, () => {
  const tag = randomBytes(4).toString('hex');
  const uid = (name: string) => `ann-${tag}-${name}`;
  const token = (name: string) => `ExponentPushToken[${tag}${name}]`;
  const MEMBERS_A: Record<string, Role> = {
    mgr: 'manager',
    deputy: 'deputy',
    owner: 'owner',
    quiet: 'owner', // coupe les annonces ordinaires (pas les urgentes)
    tenant: 'tenant',
    treasurer: 'treasurer',
    caretaker: 'caretaker',
  };
  const NAMES = [...Object.keys(MEMBERS_A), 'gone', 'mgrB', 'ownerB', 'mgrC', 'mgrD', 'ownerD'];
  let service: typeof import('./notify/service');
  let app: (typeof import('./app'))['app'];
  let resA: string;
  let resB: string;
  let resC: string;
  let resD: string;

  // --- Faux client Expo : le vrai découpage par lots, un faux réseau. ---------------------------
  const real = new Expo();
  let sent: ExpoPushMessage[] = [];
  const fake: PushClient = {
    chunkPushNotifications: (messages) => real.chunkPushNotifications(messages),
    chunkPushNotificationReceiptIds: (ids) => real.chunkPushNotificationReceiptIds(ids),
    sendPushNotificationsAsync: async (messages) => {
      sent.push(...messages);
      return messages.map((_m, index) => ({ status: 'ok' as const, id: `${tag}-ticket-${randomUUID()}-${index}` }));
    },
    getPushNotificationReceiptsAsync: async () => ({}),
  };
  const recipients = () => sent.map((m) => m.to as string).sort();
  const tokens = (...names: string[]) => names.map(token).sort();

  const api = async (userId: string | null, method: string, path: string, residence?: string, body?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-test-user'] = userId;
    if (residence) headers['X-Residence-Id'] = residence;
    const response = await app.request(path, {
      method,
      headers,
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };
  const as = (name: string, residence = resA) => ({
    get: (path: string) => api(uid(name), 'GET', path, residence),
    post: (path: string, body?: unknown) => api(uid(name), 'POST', path, residence, body ?? {}),
  });
  const valid = { category: 'info', title: 'Coupure d’eau jeudi 20 nov.', body: 'De 9 h à 13 h, pour réparer la colonne principale.' };
  const publish = (name: string, extra: Record<string, unknown> = {}, residence = resA) =>
    as(name, residence).post('/api/announcements', { ...valid, ...extra });

  const jobsOf = (residenceId: string) =>
    getDb().select().from(schema.notificationJob).where(eq(schema.notificationJob.residenceId, residenceId));
  const jobOf = async (itemId: string) => {
    const rows = await getDb().select().from(schema.notificationJob);
    return rows.find((row) => (row.data as { itemId?: string }).itemId === itemId);
  };
  const dbAnnouncements = (residenceId: string) =>
    getDb().select().from(schema.announcement).where(eq(schema.announcement.residenceId, residenceId));
  const sortKey = (row: { pinned: boolean; pinnedAt: Date | null; createdAt: Date; id: string }) => ({
    pinned: row.pinned,
    at: (row.pinnedAt ?? row.createdAt).getTime(),
    id: row.id,
  });
  /** Ordre attendu, calculé en JavaScript à partir de la base : épinglées d'abord, plus récent d'abord, id. */
  const expectedOrder = (rows: Parameters<typeof sortKey>[0][]) =>
    rows
      .map(sortKey)
      .sort((p, q) => Number(q.pinned) - Number(p.pinned) || q.at - p.at || (q.id < p.id ? -1 : q.id > p.id ? 1 : 0))
      .map((row) => row.id);

  beforeAll(async () => {
    for (const method of ['log', 'error', 'warn'] as const) vi.spyOn(console, method).mockImplementation(() => {});
    service = await import('./notify/service');
    ({ app } = await import('./app'));
    service.notifyTiming.afterCommitMs = 1_000_000; // pas d'envoi automatique : processJob est appelé à la main
    service.notifyTiming.retryMs = 1_000_000;
    setPushClientForTests(fake);

    const db = getDb();
    await db.insert(schema.user).values(NAMES.map((name) => ({ id: uid(name), name: `Nom ${uid(name)}`, email: `${uid(name)}@test.invalid` })));
    const created = await db
      .insert(schema.residence)
      .values(['A', 'B', 'C', 'D'].map((name) => ({ name: `ann-${tag} ${name}`, city: 'Test' })))
      .returning({ id: schema.residence.id, name: schema.residence.name });
    const byLetter = (letter: string) => created.find((row) => row.name.endsWith(` ${letter}`))!.id;
    [resA, resB, resC, resD] = ['A', 'B', 'C', 'D'].map(byLetter) as [string, string, string, string];

    await db.insert(schema.membership).values([
      ...Object.entries(MEMBERS_A).map(([name, role]) => ({ residenceId: resA, userId: uid(name), role })),
      // Ancien membre : inactif, jamais prévenu.
      { residenceId: resA, userId: uid('gone'), role: 'owner' as const, active: false, endedAt: new Date() },
      { residenceId: resB, userId: uid('mgrB'), role: 'manager' as const },
      { residenceId: resB, userId: uid('ownerB'), role: 'owner' as const },
      // C : le syndic seul. D : une résidence pour l'ordre et la pagination.
      { residenceId: resC, userId: uid('mgrC'), role: 'manager' as const },
      { residenceId: resD, userId: uid('mgrD'), role: 'manager' as const },
      { residenceId: resD, userId: uid('ownerD'), role: 'owner' as const },
    ]);
    await db.insert(schema.pushToken).values(
      NAMES.map((name) => ({ userId: uid(name), token: token(name), locale: 'fr' as const })),
    );
    await db.insert(schema.notificationPreference).values([
      { userId: uid('quiet'), type: 'announcement', enabled: false },
      { userId: uid('quiet'), type: 'announcement_urgent', enabled: false },
    ]);
  }, 120_000);

  beforeEach(() => {
    sent = [];
  });

  afterEach(() => {
    service.cancelScheduledNotifications();
  });

  afterAll(async () => {
    service?.stopNotifyWorker();
    setPushClientForTests();
    vi.restoreAllMocks();
    const db = getDb();
    const ids = (
      await db.select({ id: schema.residence.id }).from(schema.residence).where(like(schema.residence.name, `ann-${tag} %`))
    ).map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(schema.notificationJob).where(inArray(schema.notificationJob.residenceId, ids));
      await db.delete(schema.announcement).where(inArray(schema.announcement.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, NAMES.map(uid)));
    await closeDb();
  }, 120_000);

  // ---------------------------------------------------------------------------------------------
  describe('publication et notification', () => {
    it('le syndic publie : 201, l’auteur n’est désigné que par son rôle, l’annonce est enregistrée dans sa résidence', async () => {
      const response = await publish('mgr', { pinned: true });
      expect(response.status).toBe(201);
      expect(response.json).toMatchObject({
        category: 'info',
        title: valid.title,
        body: valid.body,
        pinned: true,
        authorRole: 'manager',
        byYou: true,
      });
      expect(response.json.pinnedAt).toEqual(expect.any(String));
      const [row] = await getDb().select().from(schema.announcement).where(eq(schema.announcement.id, response.json.id));
      expect(row).toMatchObject({ residenceId: resA, authorId: uid('mgr'), pinned: true });
    });

    it('un job est créé pour tous les membres actifs sauf l’auteur, avec l’identifiant de l’annonce seulement', async () => {
      const response = await publish('mgr');
      const job = await jobOf(response.json.id);
      expect(job).toMatchObject({ residenceId: resA, type: 'announcement', status: 'pending' });
      const audience = job!.audience as { kind: string; userIds: string[] };
      expect(audience.kind).toBe('users');
      // Tous les membres actifs de A, sauf le syndic : ni l'ancien membre, ni l'autre résidence.
      expect([...audience.userIds].sort()).toEqual(['deputy', 'owner', 'quiet', 'tenant', 'treasurer', 'caretaker'].map(uid).sort());
      expect(job!.data).toEqual({ itemId: response.json.id });
      // Aucun titre ni contenu dans le job.
      const stored = JSON.stringify(job);
      expect(stored).not.toContain(valid.title);
      expect(stored).not.toContain(valid.body);
    });

    it('l’envoi (Expo simulé) atteint les membres actifs sauf l’auteur et ceux qui ont coupé ce type, sans titre ni nom dans le texte', async () => {
      const response = await publish('mgr', { title: 'Titre secret de l’annonce', body: 'Contenu secret de l’annonce' });
      const job = await jobOf(response.json.id);
      expect(await service.processJob(job!.id)).toBe('sent');
      // Ni l'auteur (mgr), ni « quiet » (a coupé les annonces), ni l'ancien membre, ni l'autre résidence.
      expect(recipients()).toEqual(tokens('deputy', 'owner', 'tenant', 'treasurer', 'caretaker'));
      const text = notificationText('announcement', 'fr');
      for (const message of sent) {
        expect(message).toMatchObject({ title: text.title, body: text.body });
        expect(message.data).toEqual({ type: 'announcement', residenceId: resA, itemId: response.json.id });
        const serialized = JSON.stringify(message);
        for (const secret of ['Titre secret', 'Contenu secret', 'Nom ann-', uid('mgr')]) expect(serialized).not.toContain(secret);
      }
    });

    it('un adjoint publie : le syndic est prévenu, pas l’adjoint', async () => {
      const response = await publish('deputy');
      expect(response.status).toBe(201);
      expect(response.json.authorRole).toBe('deputy');
      const job = await jobOf(response.json.id);
      await service.processJob(job!.id);
      expect(recipients()).toContain(token('mgr'));
      expect(recipients()).not.toContain(token('deputy'));
    });

    it('catégorie urgent : type announcement_urgent, reçu même par qui a coupé les annonces ; les autres catégories : announcement', async () => {
      for (const category of ANNOUNCEMENT_CATEGORIES) {
        sent = [];
        const response = await publish('mgr', { category });
        expect(response.status).toBe(201);
        const job = await jobOf(response.json.id);
        expect(job!.type).toBe(category === 'urgent' ? 'announcement_urgent' : 'announcement');
        await service.processJob(job!.id);
        if (category === 'urgent') {
          expect(recipients()).toEqual(tokens('deputy', 'owner', 'quiet', 'tenant', 'treasurer', 'caretaker'));
          expect(sent[0]!.body).toBe(notificationText('announcement_urgent', 'fr').body);
        } else {
          expect(recipients()).not.toContain(token('quiet'));
          expect(sent[0]!.body).toBe(notificationText('announcement', 'fr').body);
        }
      }
    });

    it('syndic seul dans sa résidence : l’annonce est publiée, aucun envoi n’est enregistré', async () => {
      const response = await publish('mgrC', {}, resC);
      expect(response.status).toBe(201);
      expect(await jobsOf(resC)).toHaveLength(0);
    });

    it('refus sans announcements.write : 403 pour owner, tenant, treasurer et caretaker, rien n’est créé', async () => {
      const before = (await dbAnnouncements(resA)).length;
      const jobsBefore = (await jobsOf(resA)).length;
      for (const name of ['owner', 'quiet', 'tenant', 'treasurer', 'caretaker']) {
        const response = await publish(name);
        expect({ name, status: response.status }).toEqual({ name, status: 403 });
      }
      expect(await dbAnnouncements(resA)).toHaveLength(before);
      expect(await jobsOf(resA)).toHaveLength(jobsBefore);
    });

    it('un ancien membre (inactif) ne peut ni publier ni lire', async () => {
      expect((await publish('gone')).status).toBe(403);
      expect((await as('gone').get('/api/announcements')).status).toBe(403);
    });

    it('limites : titre 80, texte 1000 ; au-delà, vide, catégorie inconnue ou champ en trop → 400 sans rien créer', async () => {
      const before = (await dbAnnouncements(resA)).length;
      expect((await publish('mgr', { title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH) })).status).toBe(201);
      expect((await publish('mgr', { body: 'b'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH) })).status).toBe(201);
      const refused = before + 2;
      for (const extra of [
        { title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH + 1) },
        { body: 'b'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH + 1) },
        { title: '   ' },
        { body: '' },
        { category: 'party' },
        { authorId: uid('owner') },
        { residenceId: resB },
      ]) {
        const response = await publish('mgr', extra);
        expect({ extra, status: response.status }).toEqual({ extra, status: 400 });
      }
      expect(await dbAnnouncements(resA)).toHaveLength(refused);
    });

    it('la résidence vient de l’en-tête, jamais du corps : publier avec l’en-tête de B n’écrit rien dans A', async () => {
      const response = await publish('mgr', {}, resB);
      expect(response.status).toBe(403);
    });

    it('nombre de membres prévenus : membres actifs sans l’auteur, réservé à announcements.write', async () => {
      const manager = await as('mgr').get('/api/announcements/audience');
      expect(manager.json).toEqual({ count: 6 });
      expect((await as('deputy').get('/api/announcements/audience')).json).toEqual({ count: 6 });
      expect((await as('owner').get('/api/announcements/audience')).status).toBe(403);
      expect((await publish('mgrC', {}, resC)).status).toBe(201);
      expect((await as('mgrC', resC).get('/api/announcements/audience')).json).toEqual({ count: 0 });
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('liste, ordre et pagination', () => {
    it('épinglées d’abord, puis de la plus récente à la plus ancienne', async () => {
      const first = (await publish('mgrD', { title: 'Première' }, resD)).json;
      const second = (await publish('mgrD', { title: 'Deuxième' }, resD)).json;
      const third = (await publish('mgrD', { title: 'Troisième' }, resD)).json;
      expect((await as('mgrD', resD).post(`/api/announcements/${first.id}/pin`, { pinned: true })).status).toBe(200);
      const list = await as('ownerD', resD).get('/api/announcements');
      expect(list.status).toBe(200);
      expect(list.json.items.map((item: any) => item.id)).toEqual([first.id, third.id, second.id]);
      expect(list.json.items.map((item: any) => item.pinned)).toEqual([true, false, false]);
      expect(list.json.nextCursor).toBeNull();
    });

    it('plusieurs épinglées : la plus récemment épinglée en tête ; désépingler remet l’annonce à sa place', async () => {
      const list = (await as('ownerD', resD).get('/api/announcements')).json.items as any[];
      const [pinned, ...others] = list;
      const lastOne = others.at(-1);
      expect((await as('mgrD', resD).post(`/api/announcements/${lastOne.id}/pin`, { pinned: true })).status).toBe(200);
      const after = (await as('ownerD', resD).get('/api/announcements')).json.items.map((item: any) => item.id);
      expect(after.slice(0, 2)).toEqual([lastOne.id, pinned.id]);
      await as('mgrD', resD).post(`/api/announcements/${lastOne.id}/pin`, { pinned: false });
      await as('mgrD', resD).post(`/api/announcements/${pinned.id}/pin`, { pinned: false });
      const rows = await dbAnnouncements(resD);
      expect((await as('ownerD', resD).get('/api/announcements')).json.items.map((item: any) => item.id)).toEqual(expectedOrder(rows));
    });

    it('pagination par curseur : sans doublon ni trou, même avec des dates identiques ou à la microseconde, et jamais d’autre résidence', async () => {
      const db = getDb();
      const sameInstant = new Date(Date.now() - 3 * DAY_MS);
      const rows = Array.from({ length: 37 }, (_, n) => {
        const pinned = n % 5 === 0;
        const createdAt = n % 3 === 0 ? sameInstant : new Date(sameInstant.getTime() + n * 1000);
        return {
          residenceId: resD,
          authorId: uid('mgrD'),
          category: ANNOUNCEMENT_CATEGORIES[n % 4]!,
          title: `Pagination ${n}`,
          body: 'Texte',
          pinned,
          pinnedAt: pinned ? (n % 2 === 0 ? sameInstant : new Date(sameInstant.getTime() + n * 500)) : null,
          createdAt,
        };
      });
      await db.insert(schema.announcement).values(rows);
      // Dates identiques à la milliseconde mais différentes à la microseconde : même clé de tri tronquée.
      await db.insert(schema.announcement).values(
        [0, 1, 2, 3, 4, 5].map((n) => ({
          residenceId: resD,
          authorId: uid('mgrD'),
          category: 'info' as const,
          title: `Micro ${n}`,
          body: 'Texte',
          createdAt: sql`('2026-11-10 10:00:00.123' || ${n}::text || '00+00')::timestamptz` as unknown as Date,
        })),
      );
      // Lignes par défaut (now() identique dans une même instruction) et lignes d'une autre résidence.
      await db.insert(schema.announcement).values(
        Array.from({ length: 4 }, (_, n) => ({ residenceId: resD, authorId: uid('mgrD'), category: 'info' as const, title: `Défaut ${n}`, body: 'Texte' })),
      );
      await db.insert(schema.announcement).values(
        Array.from({ length: 4 }, (_, n) => ({ residenceId: resB, authorId: uid('mgrB'), category: 'works' as const, title: `Autre ${n}`, body: 'Texte' })),
      );

      const all = await dbAnnouncements(resD);
      const idsB = new Set((await dbAnnouncements(resB)).map((row) => row.id));
      const wanted = expectedOrder(all);

      for (const limit of [1, 7, 50]) {
        const seen: string[] = [];
        let cursor: string | null = null;
        for (let guard = 0; guard < 100; guard += 1) {
          const page: Awaited<ReturnType<ReturnType<typeof as>['get']>> = await as('ownerD', resD).get(
            `/api/announcements?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          );
          expect(page.status).toBe(200);
          expect(page.json.items.length).toBeLessThanOrEqual(limit);
          seen.push(...page.json.items.map((item: any) => item.id));
          cursor = page.json.nextCursor;
          if (cursor === null) break;
          expect(page.json.items).toHaveLength(limit);
        }
        expect(cursor, `curseur final (limite ${limit})`).toBeNull();
        expect(new Set(seen).size, `doublons (limite ${limit})`).toBe(seen.length);
        expect(seen, `ordre (limite ${limit})`).toEqual(wanted);
        for (const id of seen) expect(idsB.has(id)).toBe(false);
      }
    });

    it('paramètres invalides : limite hors bornes, curseur illisible, paramètre inconnu → 400', async () => {
      const garbage = Buffer.from(JSON.stringify({ p: 'oui', t: 'hier', id: 'x' })).toString('base64url');
      for (const query of ['limit=0', 'limit=51', 'limit=abc', 'cursor=n-importe-quoi', `cursor=${garbage}`, 'offset=1', 'sort=asc', 'cursor=']) {
        const response = await as('owner').get(`/api/announcements?${query}`);
        expect({ query, status: response.status }).toEqual({ query, status: 400 });
      }
    });

    it('un curseur d’une autre résidence ne donne rien d’elle : seule la résidence de l’en-tête est lue', async () => {
      const page = await as('ownerD', resD).get('/api/announcements?limit=2');
      const other = await api(uid('ownerB'), 'GET', `/api/announcements?cursor=${encodeURIComponent(page.json.nextCursor)}`, resB);
      expect(other.status).toBe(200);
      const idsD = new Set((await dbAnnouncements(resD)).map((row) => row.id));
      for (const item of other.json.items) expect(idsD.has(item.id)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('épinglage', () => {
    it('idempotent : épingler deux fois ne change rien (même date d’épinglage), désépingler deux fois non plus', async () => {
      const { id } = (await publish('mgr')).json;
      const one = await as('mgr').post(`/api/announcements/${id}/pin`, { pinned: true });
      const two = await as('deputy').post(`/api/announcements/${id}/pin`, { pinned: true });
      expect([one.status, two.status]).toEqual([200, 200]);
      expect(one.json.pinned).toBe(true);
      // Seul `byYou` dépend de qui lit : le reste (dont la date d'épinglage) est identique.
      expect({ ...two.json, byYou: true }).toEqual(one.json);
      const off = await as('mgr').post(`/api/announcements/${id}/pin`, { pinned: false });
      const off2 = await as('mgr').post(`/api/announcements/${id}/pin`, { pinned: false });
      expect(off.json).toMatchObject({ pinned: false, pinnedAt: null });
      expect(off2.json).toEqual(off.json);
      const [row] = await getDb().select().from(schema.announcement).where(eq(schema.announcement.id, id));
      expect(row).toMatchObject({ pinned: false, pinnedAt: null });
    });

    it('deux demandes d’épinglage simultanées : même résultat, une seule date', async () => {
      const { id } = (await publish('mgr')).json;
      const [x, y] = await Promise.all([
        as('mgr').post(`/api/announcements/${id}/pin`, { pinned: true }),
        as('deputy').post(`/api/announcements/${id}/pin`, { pinned: true }),
      ]);
      expect([x.status, y.status]).toEqual([200, 200]);
      const [row] = await getDb().select().from(schema.announcement).where(eq(schema.announcement.id, id));
      expect(row).toMatchObject({ pinned: true });
      expect(row!.pinnedAt).not.toBeNull();
    });

    it('refus sans announcements.write (403) ; corps invalide (400) ; identifiant inconnu ou invalide (404)', async () => {
      const { id } = (await publish('mgr')).json;
      for (const name of ['owner', 'tenant', 'treasurer', 'caretaker']) {
        expect((await as(name).post(`/api/announcements/${id}/pin`, { pinned: true })).status).toBe(403);
      }
      expect((await as('mgr').post(`/api/announcements/${id}/pin`, {})).status).toBe(400);
      expect((await as('mgr').post(`/api/announcements/${id}/pin`, { pinned: 'oui' })).status).toBe(400);
      const missing = await as('mgr').post(`/api/announcements/${randomUUID()}/pin`, { pinned: true });
      expect(missing.status).toBe(404);
      expect(missing.json).toEqual({ error: ANNOUNCEMENT_ERRORS.notFound });
      expect((await as('mgr').post('/api/announcements/pas-un-uuid/pin', { pinned: true })).status).toBe(404);
      const [row] = await getDb().select().from(schema.announcement).where(eq(schema.announcement.id, id));
      expect(row!.pinned).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('dernière annonce et détail', () => {
    it('latest : la plus récente publiée (même si une plus ancienne est épinglée), la même pour tous les rôles', async () => {
      const old = (await publish('mgrD', { title: 'Ancienne épinglée', pinned: true }, resD)).json;
      const recent = (await publish('mgrD', { title: 'Toute récente' }, resD)).json;
      for (const name of ['mgrD', 'ownerD']) {
        const response = await as(name, resD).get('/api/announcements/latest');
        expect(response.status).toBe(200);
        expect(response.json.announcement.id).toBe(recent.id);
        expect(response.json.announcement.id).not.toBe(old.id);
      }
      const rows = await dbAnnouncements(resD);
      const newest = [...rows].sort((p, q) => q.createdAt.getTime() - p.createdAt.getTime() || (q.id < p.id ? -1 : 1))[0]!;
      expect((await as('ownerD', resD).get('/api/announcements/latest')).json.announcement.id).toBe(newest.id);
    });

    it('latest : { announcement: null } sans annonce (jamais une erreur)', async () => {
      const [fresh] = await getDb()
        .insert(schema.residence)
        .values({ name: `ann-${tag} E`, city: 'Test' })
        .returning({ id: schema.residence.id });
      await getDb().insert(schema.membership).values({ residenceId: fresh!.id, userId: uid('mgrC'), role: 'manager' });
      const response = await as('mgrC', fresh!.id).get('/api/announcements/latest');
      expect(response.status).toBe(200);
      expect(response.json).toEqual({ announcement: null });
    });

    it('détail : tous les rôles de la résidence lisent l’annonce complète', async () => {
      const { id } = (await publish('mgr', { category: 'meeting' })).json;
      for (const name of Object.keys(MEMBERS_A)) {
        const response = await as(name).get(`/api/announcements/${id}`);
        expect({ name, status: response.status }).toEqual({ name, status: 200 });
        expect(response.json).toMatchObject({ id, category: 'meeting', title: valid.title, body: valid.body, authorRole: 'manager', byYou: name === 'mgr' });
      }
    });

    it('détail : introuvable (404 avec clé de traduction) pour un identifiant inconnu, invalide ou d’une autre résidence', async () => {
      const { id } = (await publish('mgr')).json;
      for (const path of [`/api/announcements/${randomUUID()}`, '/api/announcements/pas-un-uuid']) {
        const response = await as('owner').get(path);
        expect({ path, status: response.status, json: response.json }).toEqual({ path, status: 404, json: { error: ANNOUNCEMENT_ERRORS.notFound } });
      }
      expect((await api(uid('mgrB'), 'GET', `/api/announcements/${id}`, resB)).status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('isolation et confidentialité', () => {
    it('une résidence ne voit jamais les annonces d’une autre, et n’y écrit pas', async () => {
      const a = (await publish('mgr', { title: 'Annonce de A' })).json;
      const b = (await publish('mgrB', { title: 'Annonce de B' }, resB)).json;
      const listA = (await as('owner').get('/api/announcements?limit=50')).json.items.map((item: any) => item.id);
      const listB = (await api(uid('ownerB'), 'GET', '/api/announcements?limit=50', resB)).json.items.map((item: any) => item.id);
      expect(listA).toContain(a.id);
      expect(listA).not.toContain(b.id);
      expect(listB).toContain(b.id);
      expect(listB).not.toContain(a.id);
      // Avec l'en-tête de A, l'annonce de B est introuvable : lecture comme épinglage.
      expect((await as('mgr').get(`/api/announcements/${b.id}`)).status).toBe(404);
      expect((await as('mgr').post(`/api/announcements/${b.id}/pin`, { pinned: true })).status).toBe(404);
      const [row] = await getDb().select().from(schema.announcement).where(eq(schema.announcement.id, b.id));
      expect(row!.pinned).toBe(false);
      // Le syndic de A, avec l'en-tête de B : refusé (pas membre).
      expect((await api(uid('mgr'), 'GET', '/api/announcements', resB)).status).toBe(403);
      expect((await api(uid('mgr'), 'POST', `/api/announcements/${b.id}/pin`, resB, { pinned: true })).status).toBe(403);
    });

    it('aucun nom, e-mail ni identifiant d’auteur dans les réponses, pour aucun rôle ni aucune route', async () => {
      const { id } = (await publish('deputy', { title: 'Réunion', pinned: true })).json;
      const forbidden = [...NAMES.map(uid), ...NAMES.map((name) => `Nom ${uid(name)}`), '@test.invalid'];
      const reserved = ['"authorId"', '"author"', '"authorName"', '"name"', '"email"', '"userId"', '"residenceId"'];
      for (const name of Object.keys(MEMBERS_A)) {
        const responses = [
          await as(name).get('/api/announcements?limit=50'),
          await as(name).get('/api/announcements/latest'),
          await as(name).get(`/api/announcements/${id}`),
        ];
        for (const response of responses) {
          expect(response.status, name).toBe(200);
          for (const value of [...forbidden, ...reserved]) expect(response.text, `${name} ne doit pas voir ${value}`).not.toContain(value);
        }
      }
      const managed = await as('mgr').post(`/api/announcements/${id}/pin`, { pinned: true });
      for (const value of [...forbidden, ...reserved]) expect(managed.text).not.toContain(value);
      const created = await publish('mgr');
      for (const value of [...forbidden, ...reserved]) expect(created.text).not.toContain(value);
      // L'auteur se reconnaît seul (byYou), les autres ne voient que son rôle.
      expect((await as('owner').get(`/api/announcements/${id}`)).json).toMatchObject({ authorRole: 'deputy', byYou: false });
      expect((await as('deputy').get(`/api/announcements/${id}`)).json).toMatchObject({ authorRole: 'deputy', byYou: true });
    });

    it('sans session : 401 ; sans en-tête de résidence : 400', async () => {
      for (const [method, path] of [
        ['GET', '/api/announcements'],
        ['GET', '/api/announcements/latest'],
        ['GET', '/api/announcements/audience'],
        ['GET', `/api/announcements/${randomUUID()}`],
        ['POST', '/api/announcements'],
        ['POST', `/api/announcements/${randomUUID()}/pin`],
      ] as const) {
        expect({ path, status: (await api(null, method, path, resA, {})).status }).toEqual({ path, status: 401 });
        expect({ path, status: (await api(uid('mgr'), method, path, undefined, {})).status }).toEqual({ path, status: 400 });
      }
    });
  });
});
