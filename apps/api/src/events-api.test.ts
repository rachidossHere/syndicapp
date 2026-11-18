/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration des événements notifiés et de la relance des impayés (plan 08, étape 4) :
// base de DATABASE_URL (branche Neon dev), expo-server-sdk et R2 SIMULÉS. Tout ce qui est créé est
// supprimé à la fin ; les données réelles (comptes Rachidoss et Testmest, résidences Al Andalous et
// « Résidence test ») ne sont jamais lues ni modifiées : tout est rangé sous une étiquette aléatoire.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { CHARGE_ERRORS, REMINDER_COOLDOWN_MS, type Role } from '@syndic/shared';
import { eq, inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

describe.skipIf(!configured)('événements et relances (Expo simulé)', { timeout: 300_000 }, () => {
  const tag = randomBytes(4).toString('hex');
  const uid = (name: string) => `evt-${tag}-${name}`;
  // Résidence A : le syndic, le personnel, deux copropriétaires du lot A11, un du lot A12,
  // un locataire du lot A11 et l'auteur des signalements (habitant du lot A13).
  const MEMBERS_A: Record<string, [Role, string | null]> = {
    mgr: ['manager', null],
    treasurer: ['treasurer', null],
    deputy: ['deputy', null],
    caretaker: ['caretaker', null],
    ownerA11: ['owner', 'A11'],
    coOwnerA11: ['owner', 'A11'],
    ownerA12: ['owner', 'A12'],
    ownerA13: ['owner', 'A13'],
    tenantA11: ['tenant', 'A11'],
    author: ['tenant', 'A13'],
  };
  const MEMBERS_B: Record<string, [Role, string | null]> = {
    mgrB: ['manager', null],
    ownerB11: ['owner', 'B11'],
    caretakerB: ['caretaker', null],
  };
  const NAMES = [...Object.keys(MEMBERS_A), ...Object.keys(MEMBERS_B)];
  let service: typeof import('./notify/service');
  let app: (typeof import('./app'))['app'];
  let resA: string;
  let resB: string;
  const lots = new Map<string, string>(); // « A11 » → id
  let callA: string;
  let callA2: string;
  let callB: string;
  const dueOf = new Map<string, string>(); // « A11/call1 » → id du dû

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
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };
  const as = (name: string, residence = resA) => ({
    get: (path: string) => api(uid(name), 'GET', path, residence),
    post: (path: string, body?: unknown) => api(uid(name), 'POST', path, residence, body ?? {}),
  });

  const jobsOf = (residenceId: string) =>
    getDb()
      .select()
      .from(schema.notificationJob)
      .where(eq(schema.notificationJob.residenceId, residenceId));
  const jobsOfType = async (residenceId: string, type: string) =>
    (await jobsOf(residenceId)).filter((job) => job.type === type);
  const clearJobs = async () => {
    const ids = [resA, resB];
    await getDb()
      .delete(schema.notificationJob)
      .where(inArray(schema.notificationJob.residenceId, ids));
  };
  const remindersOf = (lot: string) =>
    getDb()
      .select()
      .from(schema.chargeReminder)
      .where(eq(schema.chargeReminder.lotId, lots.get(lot)!));
  const clearReminders = () =>
    getDb()
      .delete(schema.chargeReminder)
      .where(inArray(schema.chargeReminder.residenceId, [resA, resB]));
  const userIdsOf = (job: { audience: unknown }) => {
    const audience = job.audience as { kind: string; userIds?: string[]; lotId?: string };
    expect(audience.kind).toBe('users');
    return [...audience.userIds!].sort();
  };
  const users = (...names: string[]) => names.map(uid).sort();

  const newIssue = (name: string, extra: Record<string, unknown> = {}, residence = resA) =>
    as(name, residence).post('/api/issues', {
      title: 'Fuite dans le hall',
      location: 'hall',
      urgent: false,
      ...extra,
    });

  // --- Faux client Expo : on enregistre ce qui part. ---------------------------------------------
  type Sent = { to: string; body: string; title: string; data: any };
  let sent: Sent[] = [];
  const fake: PushClient = {
    chunkPushNotifications: (messages) => [messages],
    chunkPushNotificationReceiptIds: (ids) => [ids],
    sendPushNotificationsAsync: async (messages) => {
      for (const m of messages)
        sent.push({
          to: m.to as string,
          body: m.body as string,
          title: m.title as string,
          data: m.data,
        });
      return messages.map((_m, index) => ({
        status: 'ok' as const,
        id: `${tag}-ticket-${randomUUID()}-${index}`,
      }));
    },
    getPushNotificationReceiptsAsync: async () => ({}),
  };

  beforeAll(async () => {
    for (const method of ['log', 'error', 'warn'] as const)
      vi.spyOn(console, method).mockImplementation(() => {});
    service = await import('./notify/service');
    ({ app } = await import('./app'));
    service.notifyTiming.afterCommitMs = 1_000_000; // pas d'envoi automatique : processJob est appelé à la main
    service.notifyTiming.retryMs = 1_000_000;
    setPushClientForTests(fake);
    const { setStorageForTests } = await import('./storage/r2');
    setStorageForTests({
      putObject: async () => undefined,
      getSignedReadUrl: async () => 'https://stockage.invalid/objet',
      deleteObject: async () => undefined,
      getSignedUploadUrl: async () => 'https://stockage.invalid/envoi',
      headObject: async () => null,
    });

    const db = getDb();
    await db
      .insert(schema.user)
      .values(
        NAMES.map((name) => ({
          id: uid(name),
          name: `Nom ${uid(name)}`,
          email: `${uid(name)}@test.invalid`,
        })),
      );
    const created = await db
      .insert(schema.residence)
      .values(['A', 'B'].map((name) => ({ name: `evt-${tag} ${name}`, city: 'Test' })))
      .returning({ id: schema.residence.id, name: schema.residence.name });
    resA = created.find((row) => row.name.endsWith(' A'))!.id;
    resB = created.find((row) => row.name.endsWith(' B'))!.id;
    const lotRows = await db
      .insert(schema.lot)
      .values([
        ...['A11', 'A12', 'A13', 'A14'].map((reference) => ({ residenceId: resA, reference })),
        { residenceId: resB, reference: 'B11' },
      ])
      .returning({
        id: schema.lot.id,
        reference: schema.lot.reference,
        residenceId: schema.lot.residenceId,
      });
    for (const row of lotRows) lots.set(row.reference, row.id);

    const membership = (residenceId: string, entries: Record<string, [Role, string | null]>) =>
      Object.entries(entries).map(([name, [role, lot]]) => ({
        residenceId,
        userId: uid(name),
        role,
        lotId: lot ? lots.get(lot)! : null,
      }));
    await db
      .insert(schema.membership)
      .values([...membership(resA, MEMBERS_A), ...membership(resB, MEMBERS_B)]);
    await db
      .insert(schema.pushToken)
      .values(
        NAMES.map((name) => ({
          userId: uid(name),
          token: `ExponentPushToken[${tag}${name}]`,
          locale: 'fr' as const,
        })),
      );

    // Appels de charges : A1 (A11 impayé, A12 partiel, A13 payé), A2 (A12 impayé, A14 impayé), B1 (B11 impayé).
    const [c1, c2, c3] = await db
      .insert(schema.chargeCall)
      .values([
        {
          residenceId: resA,
          periodLabel: '2026-Q3',
          amountPerLot: 45000,
          dueDate: '2026-09-30',
          createdBy: uid('mgr'),
        },
        {
          residenceId: resA,
          periodLabel: '2026-Q4',
          amountPerLot: 45000,
          dueDate: '2026-12-31',
          createdBy: uid('mgr'),
        },
        {
          residenceId: resB,
          periodLabel: '2026-Q4',
          amountPerLot: 45000,
          dueDate: '2026-12-31',
          createdBy: uid('mgrB'),
        },
      ])
      .returning({
        id: schema.chargeCall.id,
        periodLabel: schema.chargeCall.periodLabel,
        residenceId: schema.chargeCall.residenceId,
      });
    callA = c1!.id;
    callA2 = c2!.id;
    callB = c3!.id;
    const addDue = async (
      key: string,
      residenceId: string,
      callId: string,
      lot: string,
      paid: number,
    ) => {
      const [row] = await db
        .insert(schema.chargeDue)
        .values({
          residenceId,
          chargeCallId: callId,
          lotId: lots.get(lot)!,
          amountDue: 45000,
          amountPaid: paid,
          status: paid === 0 ? 'unpaid' : paid >= 45000 ? 'paid' : 'partial',
        })
        .returning({ id: schema.chargeDue.id });
      dueOf.set(key, row!.id);
    };
    await addDue('A11/1', resA, callA, 'A11', 0);
    await addDue('A12/1', resA, callA, 'A12', 10000);
    await addDue('A13/1', resA, callA, 'A13', 45000);
    await addDue('A12/2', resA, callA2, 'A12', 0);
    await addDue('A14/2', resA, callA2, 'A14', 0);
    await addDue('B11/1', resB, callB, 'B11', 0);
  }, 120_000);

  afterEach(async () => {
    service.cancelScheduledNotifications();
    sent = [];
  });

  afterAll(async () => {
    service?.stopNotifyWorker();
    setPushClientForTests();
    vi.restoreAllMocks();
    const db = getDb();
    const ids = (
      await db
        .select({ id: schema.residence.id })
        .from(schema.residence)
        .where(like(schema.residence.name, `evt-${tag} %`))
    ).map((row) => row.id);
    if (ids.length > 0) {
      await db
        .delete(schema.notificationJob)
        .where(inArray(schema.notificationJob.residenceId, ids));
      await db.delete(schema.chargeReminder).where(inArray(schema.chargeReminder.residenceId, ids));
      await db.delete(schema.receipt).where(inArray(schema.receipt.residenceId, ids));
      await db.delete(schema.payment).where(inArray(schema.payment.residenceId, ids));
      await db.delete(schema.chargeDue).where(inArray(schema.chargeDue.residenceId, ids));
      await db.delete(schema.chargeCall).where(inArray(schema.chargeCall.residenceId, ids));
      await db.delete(schema.receiptCounter).where(inArray(schema.receiptCounter.residenceId, ids));
      await db.delete(schema.issueEvent).where(inArray(schema.issueEvent.residenceId, ids));
      await db.delete(schema.issue).where(inArray(schema.issue.residenceId, ids));
      await db.delete(schema.membership).where(inArray(schema.membership.residenceId, ids));
      await db.delete(schema.lot).where(inArray(schema.lot.residenceId, ids));
      await db.delete(schema.residence).where(inArray(schema.residence.id, ids));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, NAMES.map(uid)));
    await closeDb();
  }, 120_000);

  // ---------------------------------------------------------------------------------------------
  describe('signalements', () => {
    it('changement de statut : l’auteur reçoit issue_status avec l’identifiant du signalement, personne d’autre', async () => {
      await clearJobs();
      const issue = (await newIssue('author')).json;
      // Création non urgente : aucune notification.
      expect(await jobsOf(resA)).toHaveLength(0);
      const response = await as('deputy').post(`/api/issues/${issue.id}/status`, {
        status: 'in_progress',
        message: 'Technicien demain',
      });
      expect(response.status).toBe(200);
      const jobs = await jobsOfType(resA, 'issue_status');
      expect(jobs).toHaveLength(1);
      expect(userIdsOf(jobs[0]!)).toEqual(users('author'));
      expect(jobs[0]!.data).toEqual({ itemId: issue.id });
      // Aucune trace du message ni du titre dans le job.
      expect(JSON.stringify(jobs[0])).not.toContain('Technicien');
      expect(JSON.stringify(jobs[0])).not.toContain('Fuite');
    });

    it('l’auteur d’un changement n’est pas notifié, même s’il est l’auteur du signalement', async () => {
      await clearJobs();
      const issue = (await newIssue('mgr')).json; // le syndic signale lui-même
      await as('mgr').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' });
      expect(await jobsOf(resA)).toHaveLength(0);
      // Un autre membre du personnel qui change le statut : le syndic (auteur) est prévenu.
      await as('caretaker').post(`/api/issues/${issue.id}/status`, { status: 'resolved' });
      const jobs = await jobsOfType(resA, 'issue_status');
      expect(jobs).toHaveLength(1);
      expect(userIdsOf(jobs[0]!)).toEqual(users('mgr'));
    });

    it('un message du syndic, de l’adjoint ou du gardien notifie l’auteur ; son propre message ne notifie personne', async () => {
      await clearJobs();
      const issue = (await newIssue('author')).json;
      for (const staff of ['mgr', 'deputy', 'caretaker']) {
        const response = await as(staff).post(`/api/issues/${issue.id}/comments`, {
          message: `Message de ${staff}`,
        });
        expect(response.status).toBe(201);
      }
      const jobs = await jobsOfType(resA, 'issue_status');
      expect(jobs).toHaveLength(3);
      for (const job of jobs) {
        expect(userIdsOf(job)).toEqual(users('author'));
        expect(job.data).toEqual({ itemId: issue.id });
      }
      await clearJobs();
      await as('author').post(`/api/issues/${issue.id}/comments`, { message: 'Merci' });
      expect(await jobsOf(resA)).toHaveLength(0);
    });

    it('un statut inchangé (409) ou un signalement d’une autre résidence (404) ne notifie rien', async () => {
      await clearJobs();
      const issue = (await newIssue('author')).json;
      await as('deputy').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' });
      await clearJobs();
      expect(
        (await as('deputy').post(`/api/issues/${issue.id}/status`, { status: 'in_progress' }))
          .status,
      ).toBe(409);
      expect(
        (await as('mgrB', resB).post(`/api/issues/${issue.id}/status`, { status: 'resolved' }))
          .status,
      ).toBe(404);
      expect(
        (await as('mgrB', resB).post(`/api/issues/${issue.id}/comments`, { message: 'x' })).status,
      ).toBe(404);
      expect(await jobsOf(resA)).toHaveLength(0);
      expect(await jobsOf(resB)).toHaveLength(0);
    });

    it('un nouveau signalement urgent notifie syndic, adjoint et gardien (pas l’auteur), dans sa résidence seulement', async () => {
      await clearJobs();
      const issue = (await newIssue('author', { urgent: true })).json;
      const jobs = await jobsOfType(resA, 'issue_urgent');
      expect(jobs).toHaveLength(1);
      expect(userIdsOf(jobs[0]!)).toEqual(users('mgr', 'deputy', 'caretaker'));
      expect(jobs[0]!.data).toEqual({ itemId: issue.id });
      expect(await jobsOf(resB)).toHaveLength(0);
    });

    it('l’urgent créé par un membre du personnel ne le notifie pas lui-même', async () => {
      await clearJobs();
      await newIssue('deputy', { urgent: true });
      const jobs = await jobsOfType(resA, 'issue_urgent');
      expect(userIdsOf(jobs[0]!)).toEqual(users('mgr', 'caretaker'));
    });

    it('un signalement non urgent ne crée aucun job issue_urgent ; sans autre personnel, aucun job non plus', async () => {
      await clearJobs();
      await newIssue('author', { urgent: false });
      expect(await jobsOf(resA)).toHaveLength(0);
      // Résidence B : le syndic et le gardien existent ; le gardien signale un urgent → seul le syndic.
      await newIssue('caretakerB', { urgent: true }, resB);
      const jobs = await jobsOfType(resB, 'issue_urgent');
      expect(userIdsOf(jobs[0]!)).toEqual(users('mgrB'));
      await clearJobs();
      // Le syndic de B, seul membre du personnel hors gardien, signale un urgent : le gardien reçoit.
      await newIssue('mgrB', { urgent: true }, resB);
      expect(userIdsOf((await jobsOfType(resB, 'issue_urgent'))[0]!)).toEqual(users('caretakerB'));
    });

    it('envoi réel (faux Expo) : seul l’auteur reçoit, avec le texte générique', async () => {
      await clearJobs();
      const issue = (await newIssue('author')).json;
      await as('deputy').post(`/api/issues/${issue.id}/status`, { status: 'resolved' });
      const [job] = await jobsOfType(resA, 'issue_status');
      expect(await service.processJob(job!.id)).toBe('sent');
      expect(sent.map((m) => m.to)).toEqual([`ExponentPushToken[${tag}author]`]);
      expect(sent[0]).toMatchObject({
        title: 'SyndicApp',
        body: notificationText('issue_status', 'fr').body,
        data: { type: 'issue_status', residenceId: resA, itemId: issue.id },
      });
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('paiement encaissé', () => {
    const pay = (
      name: string,
      dueKey: string,
      extra: Record<string, unknown> = {},
      residence = resA,
    ) =>
      as(name, residence).post('/api/payments', {
        chargeDueId: dueOf.get(dueKey),
        amount: 1000,
        method: 'cash',
        ...extra,
      });

    it('notifie les copropriétaires du lot (et eux seuls), avec l’identifiant du reçu', async () => {
      await clearJobs();
      const response = await pay('treasurer', 'A11/1');
      expect(response.status).toBe(201);
      const jobs = await jobsOfType(resA, 'payment_received');
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.audience).toEqual({ kind: 'lot_owners', lotId: lots.get('A11') });
      expect(jobs[0]!.data).toEqual({ itemId: response.json.receipt.id });
      // Envoi : les deux copropriétaires de A11, ni le locataire du même lot, ni les autres lots.
      expect(await service.processJob(jobs[0]!.id)).toBe('sent');
      expect(sent.map((m) => m.to).sort()).toEqual(
        ['ownerA11', 'coOwnerA11'].map((name) => `ExponentPushToken[${tag}${name}]`).sort(),
      );
      expect(sent.map((m) => m.to)).not.toContain(`ExponentPushToken[${tag}tenantA11]`);
      for (const message of sent) {
        expect(message.body).toBe(notificationText('payment_received', 'fr').body);
        expect(message.data).toMatchObject({
          type: 'payment_received',
          residenceId: resA,
          itemId: response.json.receipt.id,
        });
      }
    });

    it('un renvoi avec le même clientId ne crée ni second paiement ni seconde notification', async () => {
      await clearJobs();
      const clientId = randomUUID();
      const first = await pay('mgr', 'A12/2', { clientId });
      const second = await pay('mgr', 'A12/2', { clientId });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.json.payment.id).toBe(first.json.payment.id);
      expect(second.json.receipt).toEqual(first.json.receipt);
      expect(await jobsOfType(resA, 'payment_received')).toHaveLength(1);
      const rows = await getDb()
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.clientId, clientId));
      expect(rows).toHaveLength(1);
    });

    it('deux envois simultanés avec le même clientId : un seul paiement, une seule notification', async () => {
      await clearJobs();
      const clientId = randomUUID();
      const results = await Promise.all([
        pay('mgr', 'A14/2', { clientId }),
        pay('treasurer', 'A14/2', { clientId }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
      expect(results[0]!.json.payment.id).toBe(results[1]!.json.payment.id);
      expect(await jobsOfType(resA, 'payment_received')).toHaveLength(1);
      expect(
        await getDb().select().from(schema.payment).where(eq(schema.payment.clientId, clientId)),
      ).toHaveLength(1);
    });

    it('un paiement refusé (montant trop élevé, dû d’une autre résidence) ne notifie rien', async () => {
      await clearJobs();
      expect((await pay('mgr', 'A11/1', { amount: 99_999_999 })).status).toBe(409);
      expect((await pay('mgr', 'B11/1')).status).toBe(404);
      expect((await pay('ownerA11', 'A11/1')).status).toBe(403);
      expect(await jobsOf(resA)).toHaveLength(0);
      expect(await jobsOf(resB)).toHaveLength(0);
    });

    it('l’annulation d’un paiement ne notifie personne', async () => {
      const created = await pay('mgr', 'A11/1');
      await clearJobs();
      const cancelled = await as('mgr').post(`/api/payments/${created.json.payment.id}/cancel`, {
        reason: 'Erreur de saisie',
      });
      expect(cancelled.status).toBe(200);
      expect(await jobsOf(resA)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('relance des impayés', () => {
    const remind = (name: string, body: unknown, residence = resA) =>
      as(name, residence).post('/api/charges/reminders', body);

    it('un lot impayé : relancé, notification aux copropriétaires du lot seulement, relance enregistrée', async () => {
      await clearJobs();
      await clearReminders();
      const response = await remind('mgr', { lotId: lots.get('A11') });
      expect(response.status).toBe(200);
      expect(response.json).toEqual({ reminded: 1, skipped: 0, skippedLots: [] });
      const jobs = await jobsOfType(resA, 'charge_reminder');
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.audience).toEqual({ kind: 'lot_owners', lotId: lots.get('A11') });
      expect(jobs[0]!.data).toEqual({});
      expect(await service.processJob(jobs[0]!.id)).toBe('sent');
      expect(sent.map((m) => m.to).sort()).toEqual(
        ['ownerA11', 'coOwnerA11'].map((name) => `ExponentPushToken[${tag}${name}]`).sort(),
      );
      const reminders = await remindersOf('A11');
      expect(reminders).toHaveLength(1);
      expect(reminders[0]).toMatchObject({ residenceId: resA, sentBy: uid('mgr') });
    });

    it('une seconde relance du même lot avant 3 jours est refusée (409) avec la date de la prochaine relance', async () => {
      await clearJobs();
      await clearReminders();
      expect((await remind('mgr', { lotId: lots.get('A11') })).status).toBe(200);
      const [first] = await remindersOf('A11');
      const second = await remind('mgr', { lotId: lots.get('A11') });
      expect(second.status).toBe(409);
      expect(second.json.error).toBe(CHARGE_ERRORS.reminderTooSoon);
      expect(second.json.nextReminderAt).toBe(
        new Date(first!.createdAt.getTime() + REMINDER_COOLDOWN_MS).toISOString(),
      );
      expect(await remindersOf('A11')).toHaveLength(1);
      expect(await jobsOfType(resA, 'charge_reminder')).toHaveLength(1);
    });

    it('la limite vaut pour le lot, quel que soit l’appel de charges ; elle repart après 3 jours', async () => {
      await clearJobs();
      await clearReminders();
      // A12 a un dû dans deux appels : relancer via l'appel 1 bloque l'appel 2.
      expect((await remind('mgr', { all: true, chargeCallId: callA })).json.reminded).toBe(2); // A11, A12 (A13 payé)
      const again = await remind('mgr', { all: true, chargeCallId: callA2 });
      expect(again.json.reminded).toBe(1); // A14 ; A12 déjà relancé
      expect(again.json.skipped).toBe(1);
      expect(again.json.skippedLots.map((s: any) => s.lotId)).toEqual([lots.get('A12')]);
      // 3 jours plus tard : A11 est de nouveau relançable.
      const old = new Date(Date.now() - REMINDER_COOLDOWN_MS - 1000);
      await getDb()
        .update(schema.chargeReminder)
        .set({ createdAt: old })
        .where(eq(schema.chargeReminder.lotId, lots.get('A11')!));
      expect((await remind('mgr', { lotId: lots.get('A11') })).status).toBe(200);
    });

    it('« tout relancer » ignore les lots récents et les lots payés, et indique la prochaine date des ignorés', async () => {
      await clearJobs();
      await clearReminders();
      expect((await remind('mgr', { lotId: lots.get('A12') })).status).toBe(200);
      await clearJobs();
      const response = await remind('mgr', { all: true });
      expect(response.status).toBe(200);
      // Impayés ou partiels : A11, A12, A14 (A13 est payé). A12 vient d'être relancé.
      expect(response.json.reminded).toBe(2);
      expect(response.json.skipped).toBe(1);
      const [a12] = await remindersOf('A12');
      expect(response.json.skippedLots).toEqual([
        {
          lotId: lots.get('A12'),
          nextReminderAt: new Date(a12!.createdAt.getTime() + REMINDER_COOLDOWN_MS).toISOString(),
        },
      ]);
      const jobs = await jobsOfType(resA, 'charge_reminder');
      const audiences = jobs.map((job) => (job.audience as { lotId: string }).lotId).sort();
      expect(audiences).toEqual([lots.get('A11')!, lots.get('A14')!].sort());
      expect(await remindersOf('A13')).toHaveLength(0);
    });

    it('un lot payé : 409 ; un lot sans dû, un lot ou un appel d’une autre résidence : 404', async () => {
      await clearJobs();
      await clearReminders();
      const paid = await remind('mgr', { lotId: lots.get('A13') });
      expect(paid.status).toBe(409);
      expect(paid.json.error).toBe(CHARGE_ERRORS.reminderNothingDue);
      expect((await remind('mgr', { lotId: lots.get('B11') })).status).toBe(404);
      expect((await remind('mgr', { all: true, chargeCallId: callB })).status).toBe(404);
      expect((await remind('mgr', { lotId: randomUUID() })).status).toBe(404);
      expect(await jobsOf(resA)).toHaveLength(0);
      expect(await jobsOf(resB)).toHaveLength(0);
    });

    it('un lot dont le dû est soldé entre-temps n’est plus relancé', async () => {
      await clearReminders();
      const dueId = dueOf.get('A14/2')!;
      await getDb()
        .update(schema.chargeDue)
        .set({ amountPaid: 45000, status: 'paid' })
        .where(eq(schema.chargeDue.id, dueId));
      expect((await remind('mgr', { lotId: lots.get('A14') })).status).toBe(409);
      expect((await remind('mgr', { all: true })).json.reminded).toBe(2); // A11, A12
      await getDb()
        .update(schema.chargeDue)
        .set({ amountPaid: 0, status: 'unpaid' })
        .where(eq(schema.chargeDue.id, dueId));
    });

    it('appels simultanés : un lot n’est jamais relancé deux fois', async () => {
      await clearJobs();
      await clearReminders();
      const results = await Promise.all([
        remind('mgr', { all: true }),
        remind('mgr', { all: true }),
        remind('mgr', { all: true }),
      ]);
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(results.reduce((total, r) => total + r.json.reminded, 0)).toBe(3); // A11, A12, A14 une fois chacun
      expect(
        await getDb()
          .select()
          .from(schema.chargeReminder)
          .where(eq(schema.chargeReminder.residenceId, resA)),
      ).toHaveLength(3);
      expect(await jobsOfType(resA, 'charge_reminder')).toHaveLength(3);
      // Même chose pour un lot seul.
      await clearJobs();
      await clearReminders();
      const single = await Promise.all([
        remind('mgr', { lotId: lots.get('A11') }),
        remind('mgr', { lotId: lots.get('A11') }),
      ]);
      expect(single.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await remindersOf('A11')).toHaveLength(1);
    });

    it('isolation : une relance dans B ne touche pas A et inversement', async () => {
      await clearJobs();
      await clearReminders();
      const response = await remind('mgrB', { all: true }, resB);
      expect(response.json.reminded).toBe(1);
      const jobs = await jobsOfType(resB, 'charge_reminder');
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.audience).toEqual({ kind: 'lot_owners', lotId: lots.get('B11') });
      expect(await jobsOf(resA)).toHaveLength(0);
      // Le syndic de A ne peut pas viser B : l'en-tête de résidence l'en empêche (403, pas membre).
      expect(
        (await api(uid('mgr'), 'POST', '/api/charges/reminders', resB, { all: true })).status,
      ).toBe(403);
      expect(await remindersOf('A11')).toHaveLength(0);
    });

    it('permissions : seul le syndic relance ; le corps est validé', async () => {
      await clearJobs();
      await clearReminders();
      for (const name of ['treasurer', 'deputy', 'caretaker', 'ownerA11', 'tenantA11']) {
        expect((await remind(name, { all: true })).status, name).toBe(403);
      }
      expect((await api(null, 'POST', '/api/charges/reminders', resA, { all: true })).status).toBe(
        401,
      );
      for (const body of [
        {},
        { all: false },
        { lotId: 'pas-un-uuid' },
        { all: true, lotId: lots.get('A11') },
        { all: true, extra: 1 },
      ]) {
        expect((await remind('mgr', body)).status, JSON.stringify(body)).toBe(400);
      }
      expect(await jobsOf(resA)).toHaveLength(0);
      expect(await remindersOf('A11')).toHaveLength(0);
    });

    it('le détail d’un appel donne, au syndic seulement, la dernière relance et la prochaine possible', async () => {
      await clearReminders();
      await remind('mgr', { lotId: lots.get('A11') });
      const [reminder] = await remindersOf('A11');
      const detail = await as('mgr').get(`/api/charge-calls/${callA}`);
      const row = detail.json.dues.find((d: any) => d.lotId === lots.get('A11'));
      expect(row.lastReminderAt).toBe(reminder!.createdAt.toISOString());
      expect(row.nextReminderAt).toBe(
        new Date(reminder!.createdAt.getTime() + REMINDER_COOLDOWN_MS).toISOString(),
      );
      const never = detail.json.dues.find((d: any) => d.lotId === lots.get('A12'));
      expect(never).toMatchObject({ lastReminderAt: null, nextReminderAt: null });
      // Le trésorier (payments.write sans charges.write) ne voit rien de tout cela.
      const asTreasurer = await as('treasurer').get(`/api/charge-calls/${callA}`);
      expect(asTreasurer.status).toBe(200);
      expect(asTreasurer.text).not.toContain('lastReminderAt');
      expect(asTreasurer.text).not.toContain('nextReminderAt');
      // Après 3 jours : plus de prochaine date, la dernière relance reste connue.
      await getDb()
        .update(schema.chargeReminder)
        .set({ createdAt: new Date(Date.now() - REMINDER_COOLDOWN_MS - 1000) })
        .where(eq(schema.chargeReminder.lotId, lots.get('A11')!));
      const later = (await as('mgr').get(`/api/charge-calls/${callA}`)).json.dues.find(
        (d: any) => d.lotId === lots.get('A11'),
      );
      expect(later.nextReminderAt).toBeNull();
      expect(later.lastReminderAt).not.toBeNull();
    });

    it('envoi réel (faux Expo) : le locataire du lot ne reçoit pas le rappel', async () => {
      await clearJobs();
      await clearReminders();
      await remind('mgr', { lotId: lots.get('A11') });
      const [job] = await jobsOfType(resA, 'charge_reminder');
      await service.processJob(job!.id);
      expect(sent.map((m) => m.to)).not.toContain(`ExponentPushToken[${tag}tenantA11]`);
      expect(sent.map((m) => m.to)).not.toContain(`ExponentPushToken[${tag}ownerA12]`);
      expect(sent[0]!.body).toBe(notificationText('charge_reminder', 'fr').body);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('textes', () => {
    it('aucun texte de notification ne contient de chiffre, de nom ni de numéro de lot', () => {
      for (const type of [
        'issue_status',
        'issue_urgent',
        'charge_reminder',
        'payment_received',
      ] as const) {
        for (const locale of ['fr', 'ar'] as const) {
          const { title, body } = notificationText(type, locale);
          expect(`${title} ${body}`, `${type}/${locale}`).not.toMatch(/[0-9٠-٩]/);
          expect(`${title} ${body}`).not.toMatch(/\b[A-Z]\d{1,3}\b/);
          expect(`${title} ${body}`).not.toMatch(/MAD|DH|درهم/);
        }
      }
    });

    it('les messages envoyés ne contiennent ni nom, ni titre, ni texte libre, ni montant', async () => {
      await clearJobs();
      await clearReminders();
      const issue = (await newIssue('author', { title: 'Fuite chez Madame Alaoui', urgent: true }))
        .json;
      await as('deputy').post(`/api/issues/${issue.id}/comments`, {
        message: 'Appelez le 0612345678',
      });
      await as('mgr').post('/api/payments', {
        chargeDueId: dueOf.get('A11/1'),
        amount: 123400,
        method: 'cash',
      });
      await as('mgr').post('/api/charges/reminders', { all: true });
      for (const job of await jobsOf(resA)) await service.processJob(job.id);
      expect(sent.length).toBeGreaterThan(0);
      for (const message of sent) {
        const all = JSON.stringify({ title: message.title, body: message.body, data: message.data });
        for (const forbidden of [
          'Alaoui',
          'Fuite',
          '0612345678',
          '1234',
          '12 340',
          'A11',
          'A12',
          'Nom evt-',
          'MAD',
        ]) {
          expect(all, forbidden).not.toContain(forbidden);
        }
      }
      // Les jobs eux-mêmes : audience et identifiant seulement.
      expect(JSON.stringify(await jobsOf(resA))).not.toMatch(/Alaoui|0612345678|123400/);
      // Données jointes : type, résidence et identifiant seulement.
      for (const message of sent) {
        expect(Object.keys(message.data).sort()).toEqual(
          expect.arrayContaining(['residenceId', 'type']),
        );
        for (const key of Object.keys(message.data))
          expect(['type', 'residenceId', 'itemId']).toContain(key);
      }
      const reminderRows = (await jobsOf(resA)).filter((row) => row.type === 'charge_reminder');
      expect(reminderRows.length).toBeGreaterThan(0);
      for (const row of reminderRows) expect(row.data).toEqual({});
    });
  });
});
