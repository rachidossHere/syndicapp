/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Vérification du plan 07 (signalements) : tests qui complètent issues-api.test.ts et
// verification-04-06.test.ts. Base de DATABASE_URL (branche Neon dev) et bucket R2 des variables
// R2_* (syndicapp-dev). Tout ce qui est créé (lignes en base, objets R2, comptes de test) est
// supprimé à la fin ; les données réelles (comptes Rachidoss et Testmest, résidence Al Andalous)
// ne sont jamais lues ni modifiées : tout est rangé sous une étiquette aléatoire `verif07-…`.
//
// Un test marqué `it.fails` décrit le comportement attendu d'un constat ouvert de la vérification :
// il passe tant que le constat existe et échouera quand il sera corrigé (le retirer alors).
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { ISSUE_ERRORS, REOPEN_WINDOW_MS, type Role } from '@syndic/shared';
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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!configured)('Vérification du plan 07', { timeout: 300_000 }, () => {
  const tag = `verif07-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  const lotRef = (lot: string) => `${lot}-${tag}`;
  const MEMBERS_A: Record<string, { role: Role; lot: 'A11' | 'A12' | null }> = {
    mgr: { role: 'manager', lot: null },
    deputy: { role: 'deputy', lot: null },
    caretaker: { role: 'caretaker', lot: null },
    treasurer: { role: 'treasurer', lot: null },
    owner: { role: 'owner', lot: 'A11' },
    owner2: { role: 'owner', lot: 'A12' },
    tenant: { role: 'tenant', lot: 'A11' },
  };
  const users = [...Object.keys(MEMBERS_A), 'mgrB', 'ownerB'].map(uid);
  const RESIDENTS = ['owner', 'owner2', 'tenant', 'treasurer'];
  let app: (typeof import('./app'))['app'];
  let r2: typeof import('./storage/r2');
  let resA: string;
  let resB: string;
  const keys: string[] = [];
  /** Signalements dont l'état a été forcé directement en base (sans événement) : exclus des invariants. */
  const forced = new Set<string>();

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
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };
  const as = (name: string, residence = resA) => ({
    get: (path: string) => api(uid(name), 'GET', path, residence),
    post: (path: string, body?: unknown) => api(uid(name), 'POST', path, residence, body ?? {}),
  });

  const newIssue = (name: string, extra: Record<string, unknown> = {}, residence = resA) =>
    as(name, residence).post('/api/issues', { title: 'Fuite au parking', location: 'parking', ...extra });

  const uploadPhoto = async (name = 'tenant', residence = resA) => {
    const response = await as(name, residence).post('/api/issues/upload-url', {
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

  /** Données de A ou B lues directement en base (vérité terrain des tests de liste et de compteurs). */
  const dbIssues = (residenceId: string) =>
    getDb().select().from(schema.issue).where(eq(schema.issue.residenceId, residenceId));
  const dbEvents = (issueId: string) =>
    getDb().select().from(schema.issueEvent).where(eq(schema.issueEvent.issueId, issueId));

  beforeAll(async () => {
    for (const method of ['log', 'error', 'warn'] as const) {
      vi.spyOn(console, method).mockImplementation(() => {});
    }
    ({ app } = await import('./app'));
    r2 = await import('./storage/r2');
    r2.setStorageForTests(undefined);
    const db = getDb();
    await db.insert(schema.user).values(users.map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
    const [a] = await db.insert(schema.residence).values({ name: `${tag} A`, city: 'Casablanca' }).returning({ id: schema.residence.id });
    const [b] = await db.insert(schema.residence).values({ name: `${tag} B`, city: 'Rabat' }).returning({ id: schema.residence.id });
    [resA, resB] = [a!.id, b!.id];
    const created = await db
      .insert(schema.lot)
      .values(['A11', 'A12'].map((lot) => ({ residenceId: resA, reference: lotRef(lot) })))
      .returning({ id: schema.lot.id, reference: schema.lot.reference });
    const lots = Object.fromEntries(created.map((l) => [l.reference, l.id]));
    const [lotB] = await db.insert(schema.lot).values({ residenceId: resB, reference: lotRef('B11') }).returning({ id: schema.lot.id });
    await db.insert(schema.membership).values([
      ...Object.entries(MEMBERS_A).map(([name, { role, lot }]) => ({
        residenceId: resA,
        userId: uid(name),
        role,
        lotId: lot ? lots[lotRef(lot)]! : null,
      })),
      { residenceId: resB, userId: uid('mgrB'), role: 'manager' as const, lotId: null },
      { residenceId: resB, userId: uid('ownerB'), role: 'owner' as const, lotId: lotB!.id },
    ]);
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
      const rows = await db.select({ key: schema.issue.photoKey }).from(schema.issue).where(inArray(schema.issue.residenceId, ids));
      const all = new Set([...keys, ...rows.flatMap((row) => (row.key ? [row.key] : []))]);
      for (const key of all) await storage.deleteObject(key);
      for (const key of all) expect(await storage.headObject(key), 'objet R2 supprimé').toBeNull();
      await db.delete(schema.issueEvent).where(inArray(schema.issueEvent.residenceId, ids));
      await db.delete(schema.issue).where(inArray(schema.issue.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  // ---------------------------------------------------------------------------------------------
  describe('accès : toutes les routes de l’API', () => {
    // Routes qui n'exigent pas de résidence active (authentification seule) ou publiques.
    const NO_RESIDENCE = new Set([
      'GET /api/me',
      'GET /api/residences',
      'POST /api/residences',
      'GET /api/invitations/preview/:id',
      'POST /api/invitations/accept/:id',
    ]);
    const PUBLIC = (key: string) => key.startsWith('GET /health') || key.includes('/api/auth/');
    const normalize = (path: string) => path.replace(/:\w+/g, ':id');
    const registered = () =>
      [...new Set(app.routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${normalize(r.path)}`))].filter(
        (key) => !PUBLIC(key),
      );
    const concrete = (key: string) => {
      const [method, path] = key.split(' ') as [string, string];
      return { method, path: path.replace(/:id/g, randomUUID()) };
    };

    it('sans session : 401 sur chaque route non publique (liste lue dans le routeur, rien d’oublié)', async () => {
      const routes = registered();
      expect(routes.length).toBeGreaterThan(30);
      for (const key of routes) {
        const { method, path } = concrete(key);
        const response = await api(null, method, path, resA, method === 'GET' ? undefined : {});
        expect({ key, status: response.status }).toEqual({ key, status: 401 });
      }
    });

    it('avec session mais sans en-tête de résidence : 400 sur chaque route sauf celles qui n’en ont pas besoin', async () => {
      for (const key of registered().filter((k) => !NO_RESIDENCE.has(k))) {
        const { method, path } = concrete(key);
        const response = await api(uid('mgr'), method, path, undefined, method === 'GET' ? undefined : {});
        expect({ key, status: response.status }).toEqual({ key, status: 400 });
      }
    });

    it('la matrice des permissions (verification-04-06) couvre toutes les routes : seules les routes sans résidence en sont absentes', () => {
      const source = readFileSync(resolve(import.meta.dirname, 'verification-04-06.test.ts'), 'utf8');
      const covered = new Set(
        [...source.matchAll(/name: '([A-Z]+) (\/[^']*)'/g)].map((m) => `${m[1]} /api${normalize(m[2]!)}`),
      );
      const absent = registered().filter((key) => !covered.has(key));
      // Liste des routes absentes, volontairement exacte : une nouvelle route non sondée fait échouer ce test.
      expect(absent.sort()).toEqual([...NO_RESIDENCE].sort());
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('réponses selon le rôle', () => {
    it('un habitant ne reçoit jamais le nom, l’identifiant ou l’appartement d’un auteur, ni de champ réservé, sur aucune route', async () => {
      const issue = (await newIssue('tenant', { urgent: true })).json;
      await as('deputy').post(`/api/issues/${issue.id}/status`, { status: 'in_progress', message: 'Technicien demain' });
      await as('tenant').post(`/api/issues/${issue.id}/comments`, { message: 'Merci' });
      await as('caretaker').post(`/api/issues/${issue.id}/comments`, { message: 'Vu sur place' });
      const forbidden = [...users, lotRef('A11'), lotRef('A12')];
      const reservedKeys = ['"author"', '"authorName"', '"authorId"', '"authorLotId"', '"photoKey"', '"residenceId"', '"email"'];

      for (const name of RESIDENTS) {
        const responses = [
          await as(name).get('/api/issues'),
          await as(name).get('/api/issues?status=open,in_progress,resolved&limit=100'),
          await as(name).get('/api/issues/counts'),
          await as(name).get(`/api/issues/${issue.id}`),
        ];
        for (const response of responses) {
          expect(response.status, name).toBe(200);
          for (const value of [...forbidden, ...reservedKeys]) {
            expect(response.text, `${name} ne doit pas voir ${value}`).not.toContain(value);
          }
        }
      }
      // L'auteur se reconnaît seul (byYou), et le personnel n'est désigné que par son rôle.
      const asTenant = (await as('tenant').get(`/api/issues/${issue.id}`)).json;
      expect(asTenant.byYou).toBe(true);
      expect(asTenant.events.map((e: any) => [e.type, e.byYou, e.authorRole])).toEqual([
        ['created', true, null],
        ['status_changed', false, 'deputy'],
        ['comment', true, null],
        ['comment', false, 'caretaker'],
      ]);
      const asOther = (await as('owner2').get(`/api/issues/${issue.id}`)).json;
      expect(asOther.byYou).toBe(false);
      expect(asOther.events.every((e: any) => e.byYou === false)).toBe(true);
      expect(asOther.events.find((e: any) => e.type === 'created').authorRole).toBeNull();
    });

    it('le personnel reçoit le nom et l’appartement de l’auteur, mais jamais l’identifiant interne de l’utilisateur ni la clé de photo', async () => {
      const key = await uploadPhoto('owner');
      const issue = (await newIssue('owner', { photoKey: key })).json;
      for (const name of ['mgr', 'deputy', 'caretaker']) {
        const response = await as(name).get(`/api/issues/${issue.id}`);
        expect(response.json.author).toEqual({ name: uid('owner'), lot: lotRef('A11') });
        expect(response.text).not.toContain(key);
        expect(response.text).not.toContain('"authorId"');
      }
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('règles métier', () => {
    it('même statut : 409 sans événement ; le changement à un autre statut crée un seul événement', async () => {
      const issue = (await newIssue('tenant')).json;
      const same = await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'open' });
      expect(same.status).toBe(409);
      expect(same.json).toEqual({ error: ISSUE_ERRORS.statusUnchanged });
      expect(await dbEvents(issue.id)).toHaveLength(1);
      expect((await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' })).status).toBe(200);
      expect(await dbEvents(issue.id)).toHaveLength(2);
    });

    it('deux changements de statut simultanés vers le même statut : un seul réussit (verrou), un seul événement', async () => {
      const issue = (await newIssue('tenant')).json;
      const [x, y] = await Promise.all([
        as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' }),
        as('deputy').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' }),
      ]);
      expect([x.status, y.status].sort()).toEqual([200, 409]);
      const events = await dbEvents(issue.id);
      expect(events.filter((e) => e.type === 'status_changed')).toHaveLength(1);
    });

    it('réouverture : l’auteur seul (403 pour le syndic, l’adjoint, le gardien et un autre habitant), une seule fois même en simultané', async () => {
      const issue = (await newIssue('tenant')).json;
      await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'resolved' });
      for (const name of ['mgr', 'deputy', 'caretaker', 'owner', 'owner2', 'treasurer']) {
        const response = await as(name).post(`/api/issues/${issue.id}/reopen`);
        expect({ name, status: response.status }).toEqual({ name, status: 403 });
        expect(response.json).toEqual({ error: ISSUE_ERRORS.reopenForbidden });
      }
      const [x, y] = await Promise.all([
        as('tenant').post(`/api/issues/${issue.id}/reopen`),
        as('tenant').post(`/api/issues/${issue.id}/reopen`),
      ]);
      expect([x.status, y.status].sort()).toEqual([200, 409]);
      const [row] = await getDb().select().from(schema.issue).where(eq(schema.issue.id, issue.id));
      expect(row).toMatchObject({ status: 'open', resolvedAt: null });
      expect((await dbEvents(issue.id)).filter((e) => e.type === 'reopened')).toHaveLength(1);
    });

    it('réouverture : acceptée un peu avant 7 jours, refusée un peu après', async () => {
      const inside = (await newIssue('tenant')).json;
      const outside = (await newIssue('tenant')).json;
      const db = getDb();
      forced.add(inside.id);
      forced.add(outside.id);
      await db.update(schema.issue).set({ status: 'resolved', resolvedAt: new Date(Date.now() - REOPEN_WINDOW_MS + 5 * 60 * 1000) }).where(eq(schema.issue.id, inside.id));
      await db.update(schema.issue).set({ status: 'resolved', resolvedAt: new Date(Date.now() - REOPEN_WINDOW_MS - 5 * 60 * 1000) }).where(eq(schema.issue.id, outside.id));
      expect((await as('tenant').post(`/api/issues/${inside.id}/reopen`)).status).toBe(200);
      const late = await as('tenant').post(`/api/issues/${outside.id}/reopen`);
      expect(late.status).toBe(409);
      expect(late.json).toEqual({ error: ISSUE_ERRORS.reopenExpired });
    });

    it('un ancien membre (membership désactivé) ne peut plus rouvrir, commenter ni lire', async () => {
      const issue = (await newIssue('owner2')).json;
      await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'resolved' });
      await getDb().update(schema.membership).set({ active: false }).where(and(eq(schema.membership.residenceId, resA), eq(schema.membership.userId, uid('owner2'))));
      try {
        for (const [method, path] of [
          ['POST', `/api/issues/${issue.id}/reopen`],
          ['POST', `/api/issues/${issue.id}/comments`],
          ['GET', `/api/issues/${issue.id}`],
          ['GET', '/api/issues'],
        ] as const) {
          const response = await api(uid('owner2'), method, path, resA, method === 'POST' ? { message: 'x' } : undefined);
          expect({ path, status: response.status }).toEqual({ path, status: 403 });
        }
      } finally {
        await getDb().update(schema.membership).set({ active: true }).where(and(eq(schema.membership.residenceId, resA), eq(schema.membership.userId, uid('owner2'))));
      }
    });

    it('comportement constaté : le personnel peut remettre « Ouvert » un signalement résolu depuis plus de 7 jours (hors règle de réouverture)', async () => {
      const issue = (await newIssue('tenant')).json;
      forced.add(issue.id);
      await getDb().update(schema.issue).set({ status: 'resolved', resolvedAt: new Date(Date.now() - 30 * DAY_MS) }).where(eq(schema.issue.id, issue.id));
      const response = await as('caretaker').post(`/api/issues/${issue.id}/status`, { status: 'open' });
      expect(response.status).toBe(200);
      const events = await dbEvents(issue.id);
      expect(events.at(-1)).toMatchObject({ type: 'status_changed', fromStatus: 'resolved', toStatus: 'open' });
    });

    it('invariants : chaque signalement a son statut, resolved_at et son dernier événement cohérents, et chaque événement est de la même résidence', async () => {
      for (const residenceId of [resA, resB]) {
        for (const issue of (await dbIssues(residenceId)).filter((row) => !forced.has(row.id))) {
          const events = (await dbEvents(issue.id)).sort((p, q) => p.createdAt.getTime() - q.createdAt.getTime());
          expect(events[0]?.type, issue.id).toBe('created');
          const last = [...events].reverse().find((e) => e.toStatus !== null);
          expect(last?.toStatus, issue.id).toBe(issue.status);
          expect(issue.resolvedAt !== null, issue.id).toBe(issue.status === 'resolved');
          for (const event of events) expect(event.residenceId).toBe(issue.residenceId);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('photos', () => {
    it('URL d’envoi : 5 minutes, clé dans residences/<id>/issues/, type et taille signés (un autre type ou une autre taille est refusé par R2)', async () => {
      const upload = await as('tenant').post('/api/issues/upload-url', { contentType: 'image/png', size: PNG.byteLength });
      keys.push(upload.json.key);
      expect(upload.json.key.startsWith(`residences/${resA}/issues/`)).toBe(true);
      expect(upload.json.uploadUrl).toContain('X-Amz-Expires=300');
      expect(upload.json.uploadUrl.toLowerCase()).toMatch(/x-amz-signedheaders=[^&]*content-length/);
      expect(upload.json.uploadUrl.toLowerCase()).toMatch(/x-amz-signedheaders=[^&]*content-type/);

      const wrongType = await fetch(upload.json.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: PNG });
      expect(wrongType.ok).toBe(false);
      const wrongSize = await fetch(upload.json.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: Buffer.concat([PNG, PNG]) });
      expect(wrongSize.ok).toBe(false);
      expect(await r2.getStorage().headObject(upload.json.key)).toBeNull();
    });

    it('aucune URL publique : la clé sans signature est refusée par R2, et l’URL signée de lecture dure 5 minutes', async () => {
      const key = await uploadPhoto('tenant');
      const issue = (await newIssue('tenant', { photoKey: key })).json;
      const url = (await as('owner').get(`/api/issues/${issue.id}/photo-url`)).json;
      expect(url.expiresIn).toBe(300);
      expect(url.url).toContain('X-Amz-Expires=300');
      expect(url.filename).toBe(`signalement-${issue.id}.png`);
      const bare = await fetch(url.url.split('?')[0]);
      expect(bare.ok).toBe(false);
      expect((await fetch(url.url)).ok).toBe(true);
    });

    it('la photo d’un autre signalement de la résidence ne se lit pas par un autre identifiant, ni depuis l’autre résidence', async () => {
      const key = await uploadPhoto('tenant');
      const withPhoto = (await newIssue('tenant', { photoKey: key })).json;
      const without = (await newIssue('tenant')).json;
      expect((await as('mgr').get(`/api/issues/${without.id}/photo-url`)).status).toBe(404);
      expect((await api(uid('mgrB'), 'GET', `/api/issues/${withPhoto.id}/photo-url`, resB)).status).toBe(404);
      expect((await api(uid('mgrB'), 'GET', `/api/issues/${withPhoto.id}/photo-url`, resA)).status).toBe(403);
    });

    it.fails('constat : une clé de photo déjà rattachée à un signalement ne devrait pas pouvoir l’être à un second', async () => {
      const key = await uploadPhoto('tenant');
      expect((await newIssue('tenant', { photoKey: key })).status).toBe(201);
      const second = await newIssue('tenant', { photoKey: key });
      expect(second.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('listes et compteurs', () => {
    it('pagination stable : sans doublon ni trou, même avec des dates identiques, pour chaque filtre, et jamais d’autre résidence', async () => {
      const db = getDb();
      const sameInstant = new Date(Date.now() - 3 * DAY_MS);
      const rows = Array.from({ length: 31 }, (_, n) => {
        const status = (['open', 'in_progress', 'resolved'] as const)[n % 3]!;
        return {
          residenceId: resA,
          title: `Pagination ${n}`,
          location: 'hall' as const,
          urgent: n % 4 === 0,
          status,
          authorId: uid('tenant'),
          createdAt: n % 2 === 0 ? sameInstant : new Date(sameInstant.getTime() + n * 1000),
          resolvedAt: status === 'resolved' ? new Date() : null,
        };
      });
      await db.insert(schema.issue).values(rows);
      await db.insert(schema.issue).values(
        Array.from({ length: 4 }, (_, n) => ({ residenceId: resB, title: `Autre résidence ${n}`, location: 'roof' as const, authorId: uid('ownerB') })),
      );
      // Les événements « created » manquent aux lignes insérées à la main : sans effet sur les listes.
      const all = await dbIssues(resA);
      const idsB = new Set((await dbIssues(resB)).map((r) => r.id));

      for (const filter of [undefined, 'open,in_progress', 'resolved', 'open,resolved']) {
        const wanted = all.filter((r) => !filter || filter.split(',').includes(r.status));
        const expectedOrder = [...wanted]
          .sort((p, q) => {
            const rank = (r: typeof p) => (r.urgent && r.status !== 'resolved' ? 1 : 0);
            return rank(q) - rank(p) || q.createdAt.getTime() - p.createdAt.getTime() || (q.id < p.id ? -1 : q.id > p.id ? 1 : 0);
          })
          .map((r) => r.id);

        const seen: string[] = [];
        let total = -1;
        for (let offset = 0; offset < 200; offset += 7) {
          const query = `limit=7&offset=${offset}${filter ? `&status=${filter}` : ''}`;
          const page = await as('owner').get(`/api/issues?${query}`);
          expect(page.status).toBe(200);
          if (total === -1) total = page.json.total;
          expect(page.json.total).toBe(total);
          if (page.json.items.length === 0) break;
          seen.push(...page.json.items.map((i: any) => i.id));
        }
        expect(total, String(filter)).toBe(wanted.length);
        expect(new Set(seen).size, `doublons (${filter})`).toBe(seen.length);
        expect(seen, `ordre (${filter})`).toEqual(expectedOrder);
        for (const id of seen) expect(idsB.has(id)).toBe(false);
      }
    });

    it('paramètres invalides : limite hors bornes, décalage négatif, statut inconnu, paramètre inconnu → 400', async () => {
      for (const query of ['limit=0', 'limit=101', 'offset=-1', 'status=archived', 'status=', 'status=open,,resolved', 'sort=asc']) {
        const response = await as('owner').get(`/api/issues?${query}`);
        expect({ query, status: response.status }).toEqual({ query, status: 400 });
      }
    });

    it('compteurs exacts (comparés à la base), indépendants du filtre, et isolés par résidence', async () => {
      const expected = async (residenceId: string) => {
        const issues = await dbIssues(residenceId);
        const count = (status: string) => issues.filter((i) => i.status === status).length;
        return {
          open: count('open'),
          in_progress: count('in_progress'),
          resolved: count('resolved'),
          urgentUnresolved: issues.filter((i) => i.urgent && i.status !== 'resolved').length,
        };
      };
      for (const name of ['mgr', 'owner', 'tenant', 'caretaker']) {
        expect((await as(name).get('/api/issues/counts')).json, name).toEqual(await expected(resA));
      }
      expect((await api(uid('ownerB'), 'GET', '/api/issues/counts', resB)).json).toEqual(await expected(resB));
      // Un statut changé déplace exactement une unité d'un compteur à l'autre.
      const before = (await as('mgr').get('/api/issues/counts')).json;
      const issue = (await newIssue('tenant', { urgent: true })).json;
      expect((await as('mgr').get('/api/issues/counts')).json).toEqual({ ...before, open: before.open + 1, urgentUnresolved: before.urgentUnresolved + 1 });
      await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'resolved' });
      expect((await as('mgr').get('/api/issues/counts')).json).toEqual({ ...before, resolved: before.resolved + 1 });
    });
  });
});
