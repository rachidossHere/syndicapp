/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration du service d'envoi (plan 08, étape 2) : base de DATABASE_URL (branche Neon dev),
// expo-server-sdk SIMULÉ (aucun envoi réel). Tout ce qui est créé est supprimé à la fin.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { NOTIFICATION_MAX_ATTEMPTS, type NotificationAudience, type NotificationType } from '@syndic/shared';
import { eq, inArray } from 'drizzle-orm';
import { Expo, type ExpoPushMessage, type ExpoPushReceipt, type ExpoPushTicket } from 'expo-server-sdk';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setPushClientForTests, type PushClient } from './client';
import { notificationText } from './texts';

vi.mock('../auth', () => ({
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

const envFile = resolve(import.meta.dirname, '../../../../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const configured = Boolean(process.env.DATABASE_URL);

describe.skipIf(!configured)('service d’envoi des notifications (Expo simulé)', { timeout: 120_000 }, () => {
  const tag = randomBytes(4).toString('hex');
  const id = (name: string) => `test-${tag}-${name}`;
  const token = (name: string) => `ExponentPushToken[${tag}${name}]`;
  const residence1 = randomUUID();
  const residence2 = randomUUID();
  const residence3 = randomUUID();
  const lotA = randomUUID();
  const lotB = randomUUID();
  const lotOther = randomUUID();
  const bulkUsers = Array.from({ length: 205 }, (_, i) => id(`bulk${i}`));

  let service: typeof import('./service');
  let app: (typeof import('../app'))['app'];
  const logs: string[] = [];

  // --- Faux client Expo : le vrai découpage par lots, un faux réseau. -------------------------
  const real = new Expo();
  let sent: ExpoPushMessage[][] = [];
  let ticketFor: (message: ExpoPushMessage, index: number) => ExpoPushTicket = (_m, index) => ({
    status: 'ok',
    id: `${tag}-ticket-${randomUUID()}-${index}`,
  });
  let receiptFor: (ticketId: string) => ExpoPushReceipt | undefined = () => ({ status: 'ok' });
  let sendGate: Promise<void> | undefined;
  let sendError: Error | undefined;
  const fake: PushClient = {
    chunkPushNotifications: (messages) => real.chunkPushNotifications(messages),
    chunkPushNotificationReceiptIds: (ids) => real.chunkPushNotificationReceiptIds(ids),
    sendPushNotificationsAsync: async (messages) => {
      if (sendGate) await sendGate;
      if (sendError) throw sendError;
      sent.push(messages);
      return messages.map((message, index) => ticketFor(message, index));
    },
    getPushNotificationReceiptsAsync: async (ids) => {
      const out: Record<string, ExpoPushReceipt> = {};
      for (const ticketId of ids) {
        const receipt = receiptFor(ticketId);
        if (receipt) out[ticketId] = receipt;
      }
      return out;
    },
  };
  const messages = () => sent.flat();
  const recipientsOf = (list: ExpoPushMessage[] = messages()) => list.map((m) => m.to as string).sort();
  const tokens = (...names: string[]) => names.map(token).sort();

  const db = () => getDb();
  const send = async (
    audience: NotificationAudience,
    type: NotificationType,
    residenceId = residence1,
    data = {},
  ) => {
    const jobId = await service.notify(residenceId, audience, type, data);
    const outcome = await service.processJob(jobId);
    return { jobId, outcome };
  };
  const jobOf = async (jobId: string) =>
    (await db().select().from(schema.notificationJob).where(eq(schema.notificationJob.id, jobId)))[0]!;

  const api = async (userId: string, path: string) => {
    const response = await app.request(path, { method: 'POST', headers: { 'x-test-user': userId, 'Content-Type': 'application/json' }, body: '{}' });
    return { status: response.status, json: (await response.json()) as any };
  };

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation((...args) => void logs.push(args.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...args) => void logs.push(args.join(' ')));
    service = await import('./service');
    ({ app } = await import('../app'));
    service.notifyTiming.afterCommitMs = 1_000_000; // pas d'envoi automatique, sauf test dédié
    service.notifyTiming.retryMs = 1_000_000;
    setPushClientForTests(fake);

    const names = ['mgr', 'owner1', 'owner2', 'tenant', 'gone', 'stranger', 'ar'];
    const allUsers = [...names.map(id), ...bulkUsers];
    await db().insert(schema.user).values(allUsers.map((userId) => ({ id: userId, name: userId, email: `${userId}@test.invalid` })));
    await db().insert(schema.residence).values(
      [residence1, residence2, residence3].map((residenceId, i) => ({ id: residenceId, name: `Test ${tag} ${i}`, city: 'Test' })),
    );
    await db().insert(schema.lot).values([
      { id: lotA, residenceId: residence1, reference: 'A1' },
      { id: lotB, residenceId: residence1, reference: 'B1' },
      { id: lotOther, residenceId: residence2, reference: 'A1' },
    ]);
    await db().insert(schema.membership).values([
      { residenceId: residence1, userId: id('mgr'), role: 'manager' },
      { residenceId: residence1, userId: id('owner1'), role: 'owner', lotId: lotA },
      { residenceId: residence1, userId: id('owner2'), role: 'owner', lotId: lotB },
      { residenceId: residence1, userId: id('tenant'), role: 'tenant', lotId: lotA },
      { residenceId: residence1, userId: id('ar'), role: 'owner', lotId: lotB },
      // Ancien membre : inactif.
      { residenceId: residence1, userId: id('gone'), role: 'owner', lotId: lotA, active: false, endedAt: new Date() },
      // Autre résidence : copropriétaire du lot du même nom, jamais destinataire de residence1.
      { residenceId: residence2, userId: id('stranger'), role: 'owner', lotId: lotOther },
      ...bulkUsers.map((userId) => ({ residenceId: residence3, userId, role: 'owner' as const })),
    ]);
    await db().insert(schema.pushToken).values([
      ...['mgr', 'owner1', 'owner2', 'tenant', 'gone', 'stranger'].map((name) => ({ userId: id(name), token: token(name), locale: 'fr' as const })),
      { userId: id('ar'), token: token('ar'), locale: 'ar' as const },
      ...bulkUsers.map((userId, i) => ({ userId, token: `ExponentPushToken[${tag}bulk${i}]`, locale: 'fr' as const })),
    ]);
    // owner2 coupe les annonces et les rappels de charges.
    await db().insert(schema.notificationPreference).values([
      { userId: id('owner2'), type: 'announcement', enabled: false },
      { userId: id('owner2'), type: 'announcement_urgent', enabled: false },
      { userId: id('owner2'), type: 'charge_reminder', enabled: false },
    ]);
  }, 120_000);

  beforeEach(async () => {
    // Repart sans ticket : la lecture des reçus compte tous les tickets de la base.
    const jobs = db().select({ id: schema.notificationJob.id }).from(schema.notificationJob).where(inArray(schema.notificationJob.residenceId, [residence1, residence2, residence3]));
    await db().delete(schema.notificationTicket).where(inArray(schema.notificationTicket.jobId, jobs));
    sent = [];
    sendGate = undefined;
    sendError = undefined;
    ticketFor = (_m, index) => ({ status: 'ok', id: `${tag}-ticket-${randomUUID()}-${index}` });
    receiptFor = () => ({ status: 'ok' });
    logs.length = 0;
  });

  afterEach(() => {
    service.cancelScheduledNotifications();
  });

  afterAll(async () => {
    service?.stopNotifyWorker();
    setPushClientForTests();
    vi.restoreAllMocks();
    const residences = [residence1, residence2, residence3];
    // Les tickets partent avec le job (cascade) ; les jetons et préférences avec l'utilisateur.
    await db().delete(schema.notificationJob).where(inArray(schema.notificationJob.residenceId, residences));
    await db().delete(schema.membership).where(inArray(schema.membership.residenceId, residences));
    await db().delete(schema.lot).where(inArray(schema.lot.residenceId, residences));
    await db().delete(schema.residence).where(inArray(schema.residence.id, residences));
    await db().delete(schema.user).where(inArray(schema.user.id, [...['mgr', 'owner1', 'owner2', 'tenant', 'gone', 'stranger', 'ar'].map(id), ...bulkUsers]));
    await closeDb();
  }, 120_000);

  // ---------------------------------------------------------------------------------------------
  describe('destinataires', () => {
    it('audience « tous les membres actifs » : ni l’autre résidence, ni le membre inactif, ni la préférence coupée', async () => {
      const { outcome } = await send({ kind: 'all' }, 'announcement');
      expect(outcome).toBe('sent');
      expect(recipientsOf()).toEqual(tokens('mgr', 'owner1', 'tenant', 'ar'));
    });

    it('audience « certains rôles »', async () => {
      await send({ kind: 'roles', roles: ['manager', 'tenant'] }, 'issue_status');
      expect(recipientsOf()).toEqual(tokens('mgr', 'tenant'));
    });

    it('audience « utilisateurs précis » : seulement les membres actifs de la résidence', async () => {
      await send({ kind: 'users', userIds: [id('owner1'), id('stranger'), id('gone')] }, 'issue_status');
      expect(recipientsOf()).toEqual(tokens('owner1'));
    });

    it('audience « copropriétaires d’un lot » : rôle owner du lot, pas le locataire, pas un autre lot', async () => {
      await send({ kind: 'lot_owners', lotId: lotA }, 'issue_status');
      expect(recipientsOf()).toEqual(tokens('owner1'));
      sent = [];
      // Le lot d'une autre résidence, demandé avec residence1 : personne.
      await send({ kind: 'lot_owners', lotId: lotOther }, 'issue_status');
      expect(messages()).toEqual([]);
    });

    it('une préférence coupée est respectée (charge_reminder), sauf pour l’annonce urgente', async () => {
      await send({ kind: 'lot_owners', lotId: lotB }, 'charge_reminder');
      expect(recipientsOf()).toEqual(tokens('ar')); // owner2 a coupé ce type
      sent = [];
      await send({ kind: 'lot_owners', lotId: lotB }, 'announcement_urgent');
      expect(recipientsOf()).toEqual(tokens('owner2', 'ar')); // urgent : toujours envoyé
    });

    it('l’autre résidence ne reçoit rien', async () => {
      await send({ kind: 'all' }, 'announcement', residence2);
      expect(recipientsOf()).toEqual(tokens('stranger'));
      expect(recipientsOf()).not.toContain(token('owner1'));
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('contenu', () => {
    it('texte FR ou AR selon la locale du jeton, générique, avec seulement type, residenceId et itemId', async () => {
      const itemId = randomUUID();
      await send({ kind: 'lot_owners', lotId: lotB }, 'announcement', residence1, { itemId });
      const byToken = new Map(messages().map((m) => [m.to as string, m]));
      expect(byToken.get(token('ar'))).toMatchObject(notificationText('announcement', 'ar'));
      const frMessages = (await (async () => {
        sent = [];
        await send({ kind: 'users', userIds: [id('owner1')] }, 'announcement', residence1, { itemId });
        return messages();
      })());
      expect(frMessages[0]).toMatchObject(notificationText('announcement', 'fr'));
      expect(frMessages[0]!.body).toBe('Nouvelle annonce dans votre résidence');
      for (const message of [...byToken.values(), ...frMessages]) {
        expect(message.data).toEqual({ type: 'announcement', residenceId: residence1, itemId });
        expect(`${message.title} ${message.body}`).not.toMatch(/\d/);
      }
    });

    it('les données ne contiennent pas d’itemId quand l’appelant n’en donne pas', async () => {
      await send({ kind: 'users', userIds: [id('owner1')] }, 'issue_urgent');
      expect(messages()[0]!.data).toEqual({ type: 'issue_urgent', residenceId: residence1 });
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('envoi par lots, tickets et reçus', () => {
    it('envoie par lots de 100 au plus et enregistre un ticket par jeton', async () => {
      const { jobId } = await send({ kind: 'all' }, 'announcement', residence3);
      expect(sent.map((batch) => batch.length)).toEqual([100, 100, 5]);
      expect(new Set(messages().map((m) => m.to)).size).toBe(205);
      const tickets = await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId));
      expect(tickets).toHaveLength(205);
      expect((await jobOf(jobId)).status).toBe('sent');
    });

    it('jeton signalé invalide dès le ticket : supprimé, les autres restent', async () => {
      ticketFor = (message, index) =>
        message.to === token('tenant')
          ? { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: `${tag}-t-${randomUUID()}-${index}` };
      const { jobId } = await send({ kind: 'roles', roles: ['manager', 'tenant'] }, 'issue_status');
      const remaining = (await db().select({ token: schema.pushToken.token }).from(schema.pushToken).where(inArray(schema.pushToken.token, tokens('mgr', 'tenant')))).map((r) => r.token);
      expect(remaining).toEqual(tokens('mgr'));
      const tickets = await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId));
      expect(tickets.map((t) => t.token)).toEqual(tokens('mgr'));
      // Remet le jeton pour la suite.
      await db().insert(schema.pushToken).values({ userId: id('tenant'), token: token('tenant'), locale: 'fr' });
    });

    it('lecture des reçus : jeton DeviceNotRegistered supprimé, tickets lus supprimés, trop récents ignorés', async () => {
      const { jobId } = await send({ kind: 'roles', roles: ['manager', 'tenant'] }, 'issue_status');
      const tickets = await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId));
      const tenantTicket = tickets.find((t) => t.token === token('tenant'))!;
      receiptFor = (ticketId) =>
        ticketId === tenantTicket.ticketId
          ? { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' };

      // Trop récent : rien n'est lu.
      expect(await service.checkReceipts(new Date())).toEqual({ checked: 0, invalidTokens: 0, errors: 0 });
      expect(await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId))).toHaveLength(2);

      // Plus tard : lu.
      const later = new Date(Date.now() + service.notifyTiming.receiptMinAgeMs + 60_000);
      expect(await service.checkReceipts(later)).toEqual({ checked: 2, invalidTokens: 1, errors: 1 });
      expect(await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId))).toHaveLength(0);
      const left = await db().select().from(schema.pushToken).where(inArray(schema.pushToken.token, tokens('mgr', 'tenant')));
      expect(left.map((r) => r.token)).toEqual(tokens('mgr'));
      await db().insert(schema.pushToken).values({ userId: id('tenant'), token: token('tenant'), locale: 'fr' });
    });

    it('un reçu pas encore disponible garde le ticket, sauf après 24 h', async () => {
      const { jobId } = await send({ kind: 'users', userIds: [id('mgr')] }, 'issue_status');
      receiptFor = () => undefined;
      const later = new Date(Date.now() + service.notifyTiming.receiptMinAgeMs + 60_000);
      await service.checkReceipts(later);
      expect(await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId))).toHaveLength(1);
      await service.checkReceipts(new Date(Date.now() + service.notifyTiming.receiptMaxAgeMs + 60_000));
      expect(await db().select().from(schema.notificationTicket).where(eq(schema.notificationTicket.jobId, jobId))).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('reprise et tentatives', () => {
    it('3 tentatives au maximum, puis failed avec un code d’erreur ; pas de 4e tentative', async () => {
      sendError = Object.assign(new Error('réseau coupé ExponentPushToken[secret]'), { code: 'ECONNRESET' });
      const jobId = await service.notify(residence1, { kind: 'users', userIds: [id('mgr')] }, 'issue_status');
      expect(await service.processJob(jobId)).toBe('retry');
      expect(await service.processJob(jobId)).toBe('retry');
      expect(await service.processJob(jobId)).toBe('failed');
      expect(await service.processJob(jobId)).toBe('skipped');
      const job = await jobOf(jobId);
      expect(job).toMatchObject({ status: 'failed', attempts: NOTIFICATION_MAX_ATTEMPTS });
      expect(job.errorCode).toContain('ECONNRESET');
      expect(job.errorCode).not.toContain('secret');
      expect(logs.join('\n')).not.toMatch(/ExponentPushToken|secret/);
    });

    it('une nouvelle tentative réussie ne renvoie pas aux jetons déjà servis', async () => {
      const jobId = await service.notify(residence1, { kind: 'roles', roles: ['manager', 'tenant'] }, 'issue_status');
      sendError = new Error('panne');
      expect(await service.processJob(jobId)).toBe('retry');
      expect(messages()).toEqual([]);
      // Le syndic avait déjà un ticket pour ce job (envoi partiel) : seul le locataire est servi.
      await db().insert(schema.notificationTicket).values({ jobId, ticketId: `${tag}-deja`, token: token('mgr') });
      sendError = undefined;
      expect(await service.processJob(jobId)).toBe('sent');
      expect(recipientsOf()).toEqual(tokens('tenant'));
      expect((await jobOf(jobId)).attempts).toBe(2);
    });

    it('au démarrage, reprend les jobs pending et abandonne ceux qui ont épuisé leurs tentatives', async () => {
      const [fresh, exhausted] = await db()
        .insert(schema.notificationJob)
        .values([
          { residenceId: residence1, type: 'issue_status', audience: { kind: 'users', userIds: [id('owner1')] }, data: {} },
          { residenceId: residence1, type: 'issue_status', audience: { kind: 'users', userIds: [id('owner1')] }, data: {}, attempts: NOTIFICATION_MAX_ATTEMPTS },
        ])
        .returning({ id: schema.notificationJob.id });
      const result = await service.resumePendingJobs();
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(await jobOf(fresh!.id)).toMatchObject({ status: 'sent' });
      expect(await jobOf(exhausted!.id)).toMatchObject({ status: 'failed', errorCode: 'max_attempts' });
      expect(recipientsOf()).toEqual(tokens('owner1'));
    });

    it('notify dans une transaction annulée n’enregistre rien (et n’envoie rien)', async () => {
      let jobId = '';
      await expect(
        db().transaction(async (tx) => {
          jobId = await service.notify(residence1, { kind: 'all' }, 'announcement', {}, tx);
          throw new Error('annulée');
        }),
      ).rejects.toThrow('annulée');
      expect(await db().select().from(schema.notificationJob).where(eq(schema.notificationJob.id, jobId))).toHaveLength(0);
      expect(await service.processJob(jobId)).toBe('skipped');
      expect(messages()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('endpoint de test et non-blocage', () => {
    it('la réponse HTTP n’attend pas l’envoi', async () => {
      service.notifyTiming.afterCommitMs = 0;
      let release!: () => void;
      sendGate = new Promise<void>((resolveGate) => (release = resolveGate));
      try {
        const response = await Promise.race([
          api(id('mgr'), '/api/dev/notifications/test'),
          new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 20_000)),
        ]);
        // L'envoi est bloqué, la réponse est pourtant arrivée.
        expect(response).not.toBe('timeout');
        const { status, json } = response as { status: number; json: any };
        expect(status).toBe(200);
        expect(messages()).toEqual([]);
        expect((await jobOf(json.id)).status).toBe('pending');
        release();
        for (let i = 0; i < 100 && (await jobOf(json.id)).status !== 'sent'; i += 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect((await jobOf(json.id)).status).toBe('sent');
        expect(recipientsOf()).toEqual(tokens('mgr'));
      } finally {
        release();
        service.notifyTiming.afterCommitMs = 1_000_000;
      }
    });

    it('l’endpoint de test exige une session (401) et une résidence (404 sans membre)', async () => {
      const anonymous = await app.request('/api/dev/notifications/test', { method: 'POST' });
      expect(anonymous.status).toBe(401);
      const noResidence = await api(randomUUID(), '/api/dev/notifications/test');
      expect(noResidence.status).toBe(404);
    });
  });
});
