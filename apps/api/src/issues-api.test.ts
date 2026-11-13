/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration de l'API des signalements (plan 07, étape 1) : base de DATABASE_URL
// (branche Neon dev) et bucket R2 des variables R2_* (syndicapp-dev). Toutes les données et tous
// les fichiers créés sont supprimés à la fin. Sans base ou sans R2, les tests sont ignorés.
// La session est simulée par l'en-tête x-test-user : tout le reste (routes, base, R2) est réel.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { ISSUE_ERRORS, REOPEN_WINDOW_DAYS, type Role } from '@syndic/shared';
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

// PNG 1×1 valide : une vraie image pour l'envoi réel vers R2.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!configured)('API des signalements', { timeout: 120_000 }, () => {
  const tag = `test-${randomBytes(4).toString('hex')}`;
  const uid = (name: string) => `${tag}-${name}`;
  // Rôle et lot de chaque membre de A, puis ceux de B.
  const MEMBERS_A: Record<string, { role: Role; lot: 'A11' | 'A12' | null }> = {
    mgrA: { role: 'manager', lot: null },
    treasurerA: { role: 'treasurer', lot: null },
    deputyA: { role: 'deputy', lot: null },
    ownerA11: { role: 'owner', lot: 'A11' },
    ownerA12: { role: 'owner', lot: 'A12' },
    tenantA11: { role: 'tenant', lot: 'A11' },
    caretakerA: { role: 'caretaker', lot: null },
  };
  const users = [...Object.keys(MEMBERS_A), 'mgrB', 'ownerB'].map(uid);
  // Références de lots distinctives : on cherche leur présence dans les réponses brutes.
  const lotRef = (lot: string) => `${lot}-${tag}`;
  let app: (typeof import('./app'))['app'];
  let r2: typeof import('./storage/r2');
  let resA: string;
  let resB: string;
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
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };
  const as = (name: string, residence = resA) => ({
    get: (path: string) => api(uid(name), 'GET', path, residence),
    post: (path: string, body?: unknown) => api(uid(name), 'POST', path, residence, body ?? {}),
  });

  /** Envoie une vraie image vers R2 par l'URL signée et renvoie sa clé. */
  const uploadPhoto = async (name = 'tenantA11', residence = resA) => {
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

  const newIssue = (name: string, extra: Record<string, unknown> = {}, residence = resA) =>
    as(name, residence).post('/api/issues', {
      title: 'Ascenseur bloqué au 3e',
      location: 'elevator',
      ...extra,
    });

  const eventTypes = (issue: any) => issue.events.map((event: any) => event.type);

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
      .values(['A11', 'A12'].map((lot) => ({ residenceId: resA, reference: lotRef(lot) })))
      .returning({ id: schema.lot.id, reference: schema.lot.reference });
    const lots = Object.fromEntries(created.map((l) => [l.reference, l.id]));
    const [lotB] = await db
      .insert(schema.lot)
      .values({ residenceId: resB, reference: lotRef('B11') })
      .returning({ id: schema.lot.id });

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
      const rows = await db
        .select({ key: schema.issue.photoKey })
        .from(schema.issue)
        .where(inArray(schema.issue.residenceId, ids));
      const all = new Set([...keys, ...rows.flatMap((row) => (row.key ? [row.key] : []))]);
      for (const key of all) await storage.deleteObject(key);
      for (const key of all) {
        const url = await storage.getSignedReadUrl(key, { filename: 'x.bin', contentType: 'image/png' });
        expect((await fetch(url)).status).toBe(404);
      }

      await db.delete(schema.issueEvent).where(inArray(schema.issueEvent.residenceId, ids));
      await db.delete(schema.issue).where(inArray(schema.issue.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, users));
    await closeDb();
  });

  describe('création', () => {
    it('est acceptée pour chaque rôle, gardien, locataire et trésorier compris', async () => {
      for (const name of Object.keys(MEMBERS_A)) {
        const response = await newIssue(name, { description: 'Depuis ce matin', urgent: name === 'tenantA11' });
        expect(response.status, name).toBe(201);
        expect(response.json).toMatchObject({
          title: 'Ascenseur bloqué au 3e',
          location: 'elevator',
          status: 'open',
          byYou: true,
          hasPhoto: false,
          resolvedAt: null,
        });
        expect(eventTypes(response.json)).toEqual(['created']);
        expect(response.json.events[0]).toMatchObject({ toStatus: 'open', byYou: true });
      }
    });

    it("enregistre l'appartement de l'auteur et n'accepte ni résidence ni auteur dans le corps", async () => {
      const response = await newIssue('ownerA11');
      const [row] = await getDb().select().from(schema.issue).where(eq(schema.issue.id, response.json.id));
      expect(row!.residenceId).toBe(resA);
      expect(row!.authorId).toBe(uid('ownerA11'));
      expect(row!.authorLotId).not.toBeNull();

      for (const extra of [{ residenceId: resB }, { authorId: uid('mgrA') }, { status: 'resolved' }]) {
        expect((await newIssue('ownerA11', extra)).status).toBe(400);
      }
      // Résidence B ignorée : l'en-tête décide.
      expect((await newIssue('ownerA11', {}, resB)).status).toBe(403);
    });

    it('refuse un corps invalide (titre vide, emplacement inconnu, titre trop long)', async () => {
      expect((await newIssue('ownerA11', { title: '   ' })).status).toBe(400);
      expect((await newIssue('ownerA11', { location: 'garden' })).status).toBe(400);
      expect((await newIssue('ownerA11', { title: 'x'.repeat(121) })).status).toBe(400);
      expect((await newIssue('ownerA11', { urgent: 'oui' })).status).toBe(400);
    });

    it('refuse sans session (401) et sans en-tête de résidence (400)', async () => {
      expect((await api(null, 'POST', '/api/issues', resA, {})).status).toBe(401);
      expect((await api(uid('ownerA11'), 'POST', '/api/issues', undefined, {})).status).toBe(400);
      expect((await api(uid('ownerA11'), 'GET', '/api/issues', undefined)).status).toBe(400);
    });
  });

  describe('changement de statut', () => {
    it('est refusé (403) pour owner, tenant et treasurer, sans écrire en base', async () => {
      const issue = (await newIssue('tenantA11')).json;
      for (const name of ['ownerA11', 'ownerA12', 'tenantA11', 'treasurerA']) {
        const response = await as(name).post(`/api/issues/${issue.id}/status`, { status: 'in_progress' });
        expect(response.status, name).toBe(403);
      }
      const after = (await as('mgrA').get(`/api/issues/${issue.id}`)).json;
      expect(after.status).toBe('open');
      expect(eventTypes(after)).toEqual(['created']);
    });

    it('est accepté pour manager, deputy et caretaker, et chaque changement crée un événement', async () => {
      const issue = (await newIssue('tenantA11')).json;
      const steps: [string, string, string][] = [
        ['mgrA', 'in_progress', 'in_progress'],
        ['deputyA', 'resolved', 'resolved'],
        ['caretakerA', 'in_progress', 'in_progress'],
        ['mgrA', 'open', 'open'],
      ];
      let count = 1;
      let previous = 'open';
      for (const [name, status] of steps) {
        const response = await as(name).post(`/api/issues/${issue.id}/status`, {
          status,
          message: status === 'in_progress' ? 'Le technicien passe à 14 h.' : undefined,
        });
        expect(response.status, name).toBe(200);
        expect(response.json.status).toBe(status);
        // resolved_at rempli à « resolved », vidé sinon.
        expect(response.json.resolvedAt === null).toBe(status !== 'resolved');
        count += 1;
        expect(response.json.events).toHaveLength(count);
        expect(response.json.events.at(-1)).toMatchObject({
          type: 'status_changed',
          fromStatus: previous,
          toStatus: status,
        });
        previous = status;
      }
      expect(eventTypes((await as('tenantA11').get(`/api/issues/${issue.id}`)).json)).toEqual([
        'created',
        'status_changed',
        'status_changed',
        'status_changed',
        'status_changed',
      ]);
    });

    it('refuse un statut inconnu (400), inchangé (409) et un signalement inconnu (404)', async () => {
      const issue = (await newIssue('tenantA11')).json;
      expect((await as('mgrA').post(`/api/issues/${issue.id}/status`, { status: 'closed' })).status).toBe(400);
      expect((await as('mgrA').post(`/api/issues/${issue.id}/status`, {})).status).toBe(400);
      const same = await as('mgrA').post(`/api/issues/${issue.id}/status`, { status: 'open' });
      expect(same.status).toBe(409);
      expect(same.json).toEqual({ error: ISSUE_ERRORS.statusUnchanged });
      for (const id of [randomUUID(), 'pas-un-uuid']) {
        const response = await as('mgrA').post(`/api/issues/${id}/status`, { status: 'resolved' });
        expect(response.status).toBe(404);
        expect(response.json).toEqual({ error: ISSUE_ERRORS.notFound });
      }
    });
  });

  describe('commentaires', () => {
    it("sont acceptés pour l'auteur et pour issues.manage, refusés pour un autre habitant", async () => {
      const issue = (await newIssue('tenantA11')).json;
      for (const name of ['tenantA11', 'mgrA', 'deputyA', 'caretakerA']) {
        const response = await as(name).post(`/api/issues/${issue.id}/comments`, { message: `Message de ${name}` });
        expect(response.status, name).toBe(201);
        expect(response.json.events.at(-1)).toMatchObject({ type: 'comment', byYou: true });
      }
      for (const name of ['ownerA11', 'ownerA12', 'treasurerA']) {
        const response = await as(name).post(`/api/issues/${issue.id}/comments`, { message: 'Moi aussi' });
        expect(response.status, name).toBe(403);
        expect(response.json).toEqual({ error: ISSUE_ERRORS.commentForbidden });
      }
      const after = (await as('mgrA').get(`/api/issues/${issue.id}`)).json;
      expect(eventTypes(after)).toEqual(['created', 'comment', 'comment', 'comment', 'comment']);
    });

    it('refusent un message vide ou trop long (400) et un signalement inconnu (404)', async () => {
      const issue = (await newIssue('tenantA11')).json;
      expect((await as('tenantA11').post(`/api/issues/${issue.id}/comments`, { message: '  ' })).status).toBe(400);
      expect((await as('tenantA11').post(`/api/issues/${issue.id}/comments`, { message: 'x'.repeat(1001) })).status).toBe(400);
      expect((await as('tenantA11').post(`/api/issues/${issue.id}/comments`, {})).status).toBe(400);
      expect((await as('mgrA').post(`/api/issues/${randomUUID()}/comments`, { message: 'a' })).status).toBe(404);
    });
  });

  describe('réouverture', () => {
    const resolve = async (id: string) =>
      expect((await as('mgrA').post(`/api/issues/${id}/status`, { status: 'resolved' })).status).toBe(200);

    it("est acceptée pour l'auteur dans les 7 jours, refusée pour un autre", async () => {
      const issue = (await newIssue('tenantA11')).json;
      await resolve(issue.id);
      const resolved = (await as('tenantA11').get(`/api/issues/${issue.id}`)).json;
      expect(resolved.canReopen).toBe(true);
      expect((await as('mgrA').get(`/api/issues/${issue.id}`)).json.canReopen).toBe(false);

      // Un autre habitant et même le syndic : seul l'auteur rouvre.
      for (const name of ['ownerA11', 'treasurerA', 'mgrA', 'deputyA', 'caretakerA']) {
        const response = await as(name).post(`/api/issues/${issue.id}/reopen`);
        expect(response.status, name).toBe(403);
        expect(response.json).toEqual({ error: ISSUE_ERRORS.reopenForbidden });
      }
      // Résolu depuis 6 jours 23 h : encore dans le délai.
      await getDb()
        .update(schema.issue)
        .set({ resolvedAt: new Date(Date.now() - (REOPEN_WINDOW_DAYS * DAY_MS - 3_600_000)) })
        .where(eq(schema.issue.id, issue.id));
      const reopened = await as('tenantA11').post(`/api/issues/${issue.id}/reopen`, { message: 'Ça recommence.' });
      expect(reopened.status).toBe(200);
      expect(reopened.json).toMatchObject({ status: 'open', resolvedAt: null, canReopen: false });
      expect(reopened.json.events.at(-1)).toMatchObject({
        type: 'reopened',
        fromStatus: 'resolved',
        toStatus: 'open',
        message: 'Ça recommence.',
        byYou: true,
      });
    });

    it('est refusée après 7 jours (409) et pour un signalement non résolu (409)', async () => {
      const issue = (await newIssue('tenantA11')).json;
      const notResolved = await as('tenantA11').post(`/api/issues/${issue.id}/reopen`);
      expect(notResolved.status).toBe(409);
      expect(notResolved.json).toEqual({ error: ISSUE_ERRORS.notResolved });

      await resolve(issue.id);
      await getDb()
        .update(schema.issue)
        .set({ resolvedAt: new Date(Date.now() - (REOPEN_WINDOW_DAYS * DAY_MS + 3_600_000)) })
        .where(eq(schema.issue.id, issue.id));
      const expired = await as('tenantA11').post(`/api/issues/${issue.id}/reopen`);
      expect(expired.status).toBe(409);
      expect(expired.json).toEqual({ error: ISSUE_ERRORS.reopenExpired });
      const after = (await as('tenantA11').get(`/api/issues/${issue.id}`)).json;
      expect(after).toMatchObject({ status: 'resolved', canReopen: false });
      expect(eventTypes(after)).toEqual(['created', 'status_changed']);
    });
  });

  describe("visibilité de l'auteur", () => {
    it("n'envoie aucun nom ni appartement d'auteur à owner, tenant et treasurer, quelle que soit la route", async () => {
      const issue = (await newIssue('ownerA11', { description: 'Fuite' })).json;
      await as('mgrA').post(`/api/issues/${issue.id}/status`, { status: 'in_progress', message: 'Pris en charge' });
      await as('ownerA11').post(`/api/issues/${issue.id}/comments`, { message: 'Merci' });
      await as('caretakerA').post(`/api/issues/${issue.id}/comments`, { message: 'Je passe demain' });

      const forbidden = [uid('ownerA11'), lotRef('A11'), uid('mgrA'), uid('caretakerA')];
      for (const name of ['ownerA12', 'tenantA11', 'treasurerA']) {
        const responses = [
          await as(name).get('/api/issues?limit=100'),
          await as(name).get(`/api/issues/${issue.id}`),
          await as(name).post('/api/issues', { title: 'Autre', location: 'hall' }),
        ];
        for (const response of responses) {
          expect(response.status, name).toBeLessThan(300);
          for (const secret of forbidden) expect(response.text, `${name} : ${secret}`).not.toContain(secret);
          expect(response.text).not.toContain('"author"');
          expect(response.text).not.toContain('authorName');
        }
        // Le personnel est désigné par son rôle ; l'auteur du signalement par rien.
        const detail = (await as(name).get(`/api/issues/${issue.id}`)).json;
        expect(detail.byYou).toBe(false);
        expect(detail.events.map((e: any) => e.authorRole)).toEqual([null, 'manager', null, 'caretaker']);
        expect(detail.events.every((e: any) => e.byYou === false)).toBe(true);
      }

      // L'auteur se reconnaît (« par vous ») sans que son nom ne revienne.
      const own = await as('ownerA11').get(`/api/issues/${issue.id}`);
      expect(own.json.byYou).toBe(true);
      expect(own.json.events.map((e: any) => e.byYou)).toEqual([true, false, true, false]);
      expect(own.text).not.toContain(uid('ownerA11'));
      expect(own.text).not.toContain('"author"');
    });

    it("envoie le nom et l'appartement de l'auteur aux rôles avec issues.manage", async () => {
      const issue = (await newIssue('ownerA11')).json;
      for (const name of ['mgrA', 'deputyA', 'caretakerA']) {
        const detail = (await as(name).get(`/api/issues/${issue.id}`)).json;
        expect(detail.author).toEqual({ name: uid('ownerA11'), lot: lotRef('A11') });
        expect(detail.events[0]).toMatchObject({ authorName: uid('ownerA11'), authorRole: 'owner' });
        const listed = (await as(name).get('/api/issues?limit=100')).json.items.find((i: any) => i.id === issue.id);
        expect(listed.author).toEqual({ name: uid('ownerA11'), lot: lotRef('A11') });
      }
    });

    it('tous les membres voient tous les signalements de la résidence', async () => {
      const issue = (await newIssue('ownerA11')).json;
      for (const name of Object.keys(MEMBERS_A)) {
        const response = await as(name).get(`/api/issues/${issue.id}`);
        expect(response.status, name).toBe(200);
        expect(response.json.title).toBe('Ascenseur bloqué au 3e');
      }
    });
  });

  describe('liste', () => {
    it('place les urgents non résolus en premier, filtre par statut et pagine', async () => {
      const normal = (await newIssue('ownerA11', { title: 'Normal' })).json;
      const urgent = (await newIssue('ownerA11', { title: 'Urgent', urgent: true })).json;
      const urgentResolved = (await newIssue('ownerA11', { title: 'Urgent résolu', urgent: true })).json;
      await as('mgrA').post(`/api/issues/${urgentResolved.id}/status`, { status: 'resolved' });
      const urgentInProgress = (await newIssue('ownerA11', { title: 'Urgent en cours', urgent: true })).json;
      await as('mgrA').post(`/api/issues/${urgentInProgress.id}/status`, { status: 'in_progress' });

      const list = (await as('ownerA12').get('/api/issues?limit=100')).json;
      const flags = list.items.map((item: any) => item.urgent && item.status !== 'resolved');
      // Tous les urgents non résolus d'abord : aucun « vrai » après un « faux ».
      expect(flags.indexOf(false)).toBeGreaterThan(-1);
      expect(flags.slice(flags.indexOf(false)).includes(true)).toBe(false);
      const position = (id: string) => list.items.findIndex((item: any) => item.id === id);
      expect(position(urgent.id)).toBeLessThan(position(normal.id));
      expect(position(urgentInProgress.id)).toBeLessThan(position(normal.id));
      expect(position(urgent.id)).toBeLessThan(position(urgentResolved.id)); // résolu : plus prioritaire
      expect(position(urgentInProgress.id)).toBeLessThan(position(urgentResolved.id));
      expect(list.total).toBe(list.items.length);

      const open = (await as('ownerA12').get('/api/issues?status=open&limit=100')).json;
      expect(open.items.every((item: any) => item.status === 'open')).toBe(true);
      expect(open.items.map((item: any) => item.id)).toContain(normal.id);
      expect(open.items.map((item: any) => item.id)).not.toContain(urgentResolved.id);
      expect(open.total).toBe(open.items.length);
      expect(open.counts).toEqual(list.counts); // compteurs de la résidence, indépendants du filtre
      expect(list.counts.open + list.counts.in_progress + list.counts.resolved).toBe(list.total);

      const page1 = (await as('ownerA12').get('/api/issues?limit=2&offset=0')).json;
      const page2 = (await as('ownerA12').get('/api/issues?limit=2&offset=2')).json;
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(list.total);
      expect(page2.items.map((i: any) => i.id)).toEqual(list.items.slice(2, 4).map((i: any) => i.id));

      for (const query of ['status=closed', 'limit=0', 'limit=101', 'offset=-1', 'x=1']) {
        expect((await as('ownerA12').get(`/api/issues?${query}`)).status, query).toBe(400);
      }
    });
  });

  describe('photo', () => {
    it("refuse un type invalide, une taille trop grande ou nulle, sans toucher R2", async () => {
      for (const body of [
        { contentType: 'application/pdf', size: 1000 },
        { contentType: 'application/x-msdownload', size: 1000 },
        { contentType: 'image/gif', size: 1000 },
      ]) {
        const response = await as('tenantA11').post('/api/issues/upload-url', body);
        expect(response.status, body.contentType).toBe(400);
        expect(response.json).toEqual({ error: ISSUE_ERRORS.invalidFileType });
      }
      const big = await as('tenantA11').post('/api/issues/upload-url', {
        contentType: 'image/jpeg',
        size: 15 * 1024 * 1024,
      });
      expect(big.status).toBe(400);
      expect(big.json).toEqual({ error: ISSUE_ERRORS.fileTooLarge });
      for (const size of [0, -5, 1.5]) {
        expect((await as('tenantA11').post('/api/issues/upload-url', { contentType: 'image/png', size })).status).toBe(400);
      }
      expect((await as('tenantA11').post('/api/issues/upload-url', {})).status).toBe(400);
    });

    it('délivre une URL signée de 5 minutes, dans le dossier issues de la résidence', async () => {
      const response = await as('caretakerA').post('/api/issues/upload-url', {
        contentType: 'image/jpeg',
        size: 2000,
      });
      expect(response.status).toBe(200);
      expect(response.json.key).toMatch(new RegExp(`^residences/${resA}/issues/[0-9a-f-]{36}\\.jpg$`));
      expect(response.json).toMatchObject({ method: 'PUT', expiresIn: 300 });
      expect(response.json.uploadUrl).toContain('X-Amz-Expires=300');
    });

    it('enregistre une photo envoyée, la relit par URL signée, et refuse une clé invalide', async () => {
      const key = await uploadPhoto('tenantA11');
      const created = await newIssue('tenantA11', { photoKey: key });
      expect(created.status).toBe(201);
      expect(created.json).toMatchObject({ hasPhoto: true, photoContentType: 'image/png', photoSize: PNG.byteLength });
      expect(created.text).not.toContain(key); // la clé d'objet n'est jamais envoyée

      for (const name of ['ownerA12', 'treasurerA', 'mgrA']) {
        const url = await as(name).get(`/api/issues/${created.json.id}/photo-url`);
        expect(url.status, name).toBe(200);
        expect(url.json).toMatchObject({ expiresIn: 300, contentType: 'image/png' });
        expect(url.json.url).toContain('X-Amz-Expires=300');
        const file = await fetch(url.json.url);
        expect(file.status).toBe(200);
        expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
      }

      // Sans photo : 404.
      const plain = (await newIssue('tenantA11')).json;
      const none = await as('mgrA').get(`/api/issues/${plain.id}/photo-url`);
      expect(none.status).toBe(404);
      expect(none.json).toEqual({ error: ISSUE_ERRORS.photoNotFound });

      // Clé jamais envoyée vers R2, mal formée, ou hors du dossier des signalements : refusées.
      const missing = `residences/${resA}/issues/${randomUUID()}.png`;
      const bad = [
        missing,
        `residences/${resA}/issues/../invoices/${randomUUID()}.png`,
        `residences/${resA}/invoices/${randomUUID()}.png`,
        `residences/${resA}/issues/${randomUUID()}.exe`,
        `residences/${resA}/issues/${randomUUID()}.pdf`,
        'n-importe-quoi',
      ];
      for (const photoKey of bad) {
        const response = await newIssue('tenantA11', { photoKey });
        expect(response.status, photoKey).toBe(400);
        expect(response.json).toEqual({ error: ISSUE_ERRORS.photoNotFound });
      }
    });

    it("refuse la clé d'une photo d'une autre résidence, et un fichier qui n'est pas une image autorisée", async () => {
      const keyB = await uploadPhoto('ownerB', resB);
      expect(keyB).toContain(`residences/${resB}/issues/`);
      // L'objet existe bel et bien dans R2, mais il appartient à B.
      const crossed = await newIssue('tenantA11', { photoKey: keyB });
      expect(crossed.status).toBe(400);
      expect(crossed.json).toEqual({ error: ISSUE_ERRORS.photoNotFound });

      // Un objet de A mais d'un type refusé (envoyé directement, hors de l'API) : refusé à la création.
      const key = `residences/${resA}/issues/${randomUUID()}.png`;
      keys.push(key);
      await r2.getStorage().putObject(key, Buffer.from('%PDF-1.4 test'), 'application/pdf');
      const wrongType = await newIssue('tenantA11', { photoKey: key });
      expect(wrongType.status).toBe(400);
      expect(wrongType.json).toEqual({ error: ISSUE_ERRORS.invalidFileType });
    });
  });

  describe('isolation entre résidences', () => {
    it('une résidence ne lit ni n’écrit jamais dans l’autre, sur chaque route', async () => {
      const issueB = (await newIssue('ownerB', { title: 'Secret de B' }, resB)).json;
      const keyB = await uploadPhoto('ownerB', resB);
      const withPhotoB = (await newIssue('ownerB', { photoKey: keyB }, resB)).json;
      const issueA = (await newIssue('ownerA11', { title: 'Visible de A' })).json;
      const fingerprintB = async () => {
        const db = getDb();
        const issuesB = await db.select().from(schema.issue).where(eq(schema.issue.residenceId, resB));
        const eventsB = await db.select().from(schema.issueEvent).where(eq(schema.issueEvent.residenceId, resB));
        const sort = (rows: any[]) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return JSON.stringify([sort(issuesB), sort(eventsB)]);
      };
      const before = await fingerprintB();

      // 1. Le syndic de A avec l'en-tête de B : 403 partout (pas membre de B).
      const withB = (method: string, path: string, body?: unknown) => api(uid('mgrA'), method, path, resB, body);
      const crossRoutes: [string, string, unknown?][] = [
        ['POST', '/api/issues/upload-url', { contentType: 'image/png', size: 10 }],
        ['POST', '/api/issues', { title: 'Intrus', location: 'hall' }],
        ['GET', '/api/issues'],
        ['GET', `/api/issues/${issueB.id}`],
        ['POST', `/api/issues/${issueB.id}/status`, { status: 'resolved' }],
        ['POST', `/api/issues/${issueB.id}/comments`, { message: 'Intrus' }],
        ['POST', `/api/issues/${issueB.id}/reopen`, {}],
        ['GET', `/api/issues/${withPhotoB.id}/photo-url`],
      ];
      for (const [method, path, body] of crossRoutes) {
        expect((await withB(method, path, body)).status, `${method} ${path}`).toBe(403);
      }

      // 2. Avec l'en-tête de A, les identifiants de B sont introuvables.
      const withA = (method: string, path: string, body?: unknown) => api(uid('mgrA'), method, path, resA, body);
      const idRoutes: [string, string, unknown?][] = [
        ['GET', `/api/issues/${issueB.id}`],
        ['POST', `/api/issues/${issueB.id}/status`, { status: 'resolved' }],
        ['POST', `/api/issues/${issueB.id}/comments`, { message: 'Intrus' }],
        ['POST', `/api/issues/${issueB.id}/reopen`, {}],
        ['GET', `/api/issues/${withPhotoB.id}/photo-url`],
      ];
      for (const [method, path, body] of idRoutes) {
        const response = await withA(method, path, body);
        expect({ path, status: response.status }).toEqual({ path, status: 404 });
      }
      // Même l'auteur de B (ownerB) n'atteint pas son signalement avec l'en-tête de A.
      expect((await api(uid('ownerB'), 'GET', `/api/issues/${issueB.id}`, resA)).status).toBe(403);

      // 3. Les listes ne mélangent rien.
      const listA = (await withA('GET', '/api/issues?limit=100')).json;
      const listB = (await api(uid('mgrB'), 'GET', '/api/issues?limit=100', resB)).json;
      expect(listA.items.map((i: any) => i.id)).toContain(issueA.id);
      expect(listA.items.map((i: any) => i.id)).not.toContain(issueB.id);
      expect(listB.items.map((i: any) => i.id).sort()).toEqual([issueB.id, withPhotoB.id].sort());
      expect(JSON.stringify(listA)).not.toContain('Secret de B');
      expect(JSON.stringify(listB)).not.toContain('Visible de A');
      expect(JSON.stringify(listB)).not.toContain(uid('ownerA11'));

      // 4. Rien n'a bougé chez B, et la photo de B n'a pas été captée par A.
      expect(await fingerprintB()).toBe(before);
      const stolen = await newIssue('ownerA11', { photoKey: keyB });
      expect(stolen.status).toBe(400);
      expect(await fingerprintB()).toBe(before);
    });
  });

  it("n'écrit aucune URL signée ni clé d'objet dans les logs, et jamais de détail interne dans les réponses", () => {
    const all = logs.join('\n');
    expect(all).not.toContain('X-Amz-Signature');
    expect(all).not.toContain('residences/');
    for (const text of bodies) {
      expect(text).not.toMatch(/select |insert |stack|postgres/i);
    }
  });
});
