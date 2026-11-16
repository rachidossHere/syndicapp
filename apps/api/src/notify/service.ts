// Service d'envoi des notifications push (plan 08, étape 2) : SEUL point d'envoi de l'API.
//
// 1. `notify(...)` enregistre un notification_job (dans la transaction métier de l'appelant si on lui
//    passe la transaction) et programme le traitement APRÈS la réponse : il n'attend jamais Expo.
// 2. `processJob` choisit les destinataires, envoie par lots via expo-server-sdk et garde les tickets.
// 3. `checkReceipts` lit les reçus plus tard et supprime les jetons que Expo signale invalides.
// 4. `resumePendingJobs` reprend les envois restés en attente (démarrage de l'API, balayage régulier).
//
// Journaux : uniquement des nombres et des codes, jamais de jeton, de texte ni de destinataire.
import { db, schema, type Database } from '@syndic/db';
import {
  NOTIFICATION_MAX_ATTEMPTS,
  notificationAudienceSchema,
  notificationDataSchema,
  type NotificationAudience,
  type NotificationData,
  type NotificationPayload,
  type NotificationType,
} from '@syndic/shared';
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { ExpoPushMessage } from 'expo-server-sdk';

import { describeError } from '../error-log';
import { getPushClient } from './client';
import { resolveRecipients } from './recipients';
import { notificationText } from './texts';

/** Base ou transaction Drizzle : `notify` s'appelle dans une transaction métier. */
export type NotifyExecutor = Pick<Database, 'insert'>;

/** Délais (modifiables seulement par les tests). */
export const notifyTiming = {
  /** Attente avant le premier envoi : laisse la transaction de l'appelant se valider. */
  afterCommitMs: 250,
  /** Attente avant une nouvelle tentative après un échec. */
  retryMs: 30_000,
  /** Âge minimal d'un ticket avant la lecture de son reçu (Expo conseille 15 minutes). */
  receiptMinAgeMs: 15 * 60_000,
  /** Âge au-delà duquel un ticket sans reçu est abandonné (Expo garde les reçus 24 h). */
  receiptMaxAgeMs: 24 * 60 * 60_000,
  /** Période du balayage (reçus + envois en attente). */
  sweepEveryMs: 15 * 60_000,
};

const RECEIPT_BATCH = 1000;

const timers = new Set<ReturnType<typeof setTimeout>>();
const running = new Set<string>();

function code(error: unknown): string {
  const summary = describeError(error);
  return summary.code === undefined ? summary.name : `${summary.name}:${summary.code}`;
}

function log(message: string): void {
  console.log(`[notify] ${message}`);
}

function later(ms: number, work: () => Promise<unknown>): void {
  const timer = setTimeout(() => {
    timers.delete(timer);
    void work().catch((error: unknown) => log(`erreur inattendue (${code(error)})`));
  }, ms);
  timer.unref();
  timers.add(timer);
}

/** Réservé aux tests : annule les envois programmés. */
export function cancelScheduledNotifications(): void {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
}

/**
 * Enregistre une notification à envoyer, puis la programme après la réponse.
 *
 * @param executor base ou transaction de l'appelant : si la transaction est annulée, le job l'est
 *   aussi et rien n'est envoyé. Par défaut, la base.
 * @returns l'identifiant du job.
 */
export async function notify(
  residenceId: string,
  audience: NotificationAudience,
  type: NotificationType,
  data: NotificationData = {},
  executor: NotifyExecutor = db,
): Promise<string> {
  // Valide ce qui sera stocké : une audience ou des données invalides ne passent jamais.
  const validAudience = notificationAudienceSchema.parse(audience);
  const validData = notificationDataSchema.parse(data);
  const [job] = await executor
    .insert(schema.notificationJob)
    .values({ residenceId, type, audience: validAudience, data: validData })
    .returning({ id: schema.notificationJob.id });
  const id = job!.id;
  later(notifyTiming.afterCommitMs, () => processJob(id));
  return id;
}

export type JobOutcome = 'sent' | 'retry' | 'failed' | 'skipped';

/**
 * Traite un job en attente : une tentative. 3 tentatives au maximum, puis `failed` avec un code.
 * `skipped` : introuvable (transaction pas encore validée ou annulée), déjà traité ou en cours.
 */
export async function processJob(jobId: string): Promise<JobOutcome> {
  if (running.has(jobId)) return 'skipped';
  running.add(jobId);
  try {
    const [job] = await db
      .update(schema.notificationJob)
      .set({ attempts: sql`${schema.notificationJob.attempts} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(schema.notificationJob.id, jobId),
          eq(schema.notificationJob.status, 'pending'),
          lt(schema.notificationJob.attempts, NOTIFICATION_MAX_ATTEMPTS),
        ),
      )
      .returning();
    if (!job) return 'skipped';

    try {
      const counts = await deliver(job);
      await db
        .update(schema.notificationJob)
        .set({ status: 'sent', errorCode: null, sentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.notificationJob.id, jobId));
      log(
        `envoi ${job.id} : ${counts.recipients} destinataires, ${counts.tickets} tickets, ` +
          `${counts.refused} refus, ${counts.invalidTokens} jetons supprimés`,
      );
      return 'sent';
    } catch (error) {
      const errorCode = code(error).slice(0, 80);
      const exhausted = job.attempts >= NOTIFICATION_MAX_ATTEMPTS;
      await db
        .update(schema.notificationJob)
        .set({ status: exhausted ? 'failed' : 'pending', errorCode, updatedAt: new Date() })
        .where(eq(schema.notificationJob.id, jobId));
      log(`envoi ${job.id} : échec tentative ${job.attempts}/${NOTIFICATION_MAX_ATTEMPTS} (${errorCode})`);
      if (exhausted) return 'failed';
      later(notifyTiming.retryMs, () => processJob(jobId));
      return 'retry';
    }
  } finally {
    running.delete(jobId);
  }
}

type DeliveryCounts = { recipients: number; tickets: number; refused: number; invalidTokens: number };

async function deleteTokens(tokens: string[]): Promise<void> {
  if (tokens.length > 0) await db.delete(schema.pushToken).where(inArray(schema.pushToken.token, tokens));
}

async function deliver(job: typeof schema.notificationJob.$inferSelect): Promise<DeliveryCounts> {
  const audience = notificationAudienceSchema.parse(job.audience);
  const data = notificationDataSchema.parse(job.data);
  const recipients = await resolveRecipients(db, job.residenceId, audience, job.type);
  // Nouvelle tentative : pas de second envoi aux jetons qui ont déjà un ticket pour ce job.
  const already = new Set(
    (
      await db
        .select({ token: schema.notificationTicket.token })
        .from(schema.notificationTicket)
        .where(eq(schema.notificationTicket.jobId, job.id))
    ).map((row) => row.token),
  );
  // Données jointes : seulement type, residenceId et identifiant de l'élément.
  const payload: NotificationPayload = {
    type: job.type,
    residenceId: job.residenceId,
    ...(data.itemId ? { itemId: data.itemId } : {}),
  };
  // Un message par jeton (texte selon sa langue) : le ticket n° i correspond au message n° i.
  const messages: ExpoPushMessage[] = recipients
    .filter((recipient) => !already.has(recipient.token))
    .map((recipient) => ({
      to: recipient.token,
      ...notificationText(job.type, recipient.locale),
      data: payload,
      sound: 'default',
    }));

  const client = getPushClient();
  const counts: DeliveryCounts = { recipients: recipients.length, tickets: 0, refused: 0, invalidTokens: 0 };
  for (const chunk of client.chunkPushNotifications(messages)) {
    const tickets = await client.sendPushNotificationsAsync(chunk);
    const accepted: { jobId: string; ticketId: string; token: string }[] = [];
    const invalid: string[] = [];
    tickets.forEach((ticket, index) => {
      const token = chunk[index]!.to as string;
      if (ticket.status === 'ok') {
        accepted.push({ jobId: job.id, ticketId: ticket.id, token });
      } else {
        counts.refused += 1;
        // Jeton signalé invalide dès l'envoi : supprimé tout de suite.
        if (ticket.details?.error === 'DeviceNotRegistered') invalid.push(token);
      }
    });
    if (accepted.length > 0) {
      await db.insert(schema.notificationTicket).values(accepted).onConflictDoNothing();
      counts.tickets += accepted.length;
    }
    await deleteTokens(invalid);
    counts.invalidTokens += invalid.length;
  }
  return counts;
}

/**
 * Lit les reçus des tickets assez anciens, puis supprime les tickets lus. Un jeton dont le reçu
 * signale `DeviceNotRegistered` est supprimé. Un ticket sans reçu après 24 h est abandonné.
 */
export async function checkReceipts(
  now: Date = new Date(),
): Promise<{ checked: number; invalidTokens: number; errors: number }> {
  const { notificationTicket } = schema;
  const tickets = await db
    .select()
    .from(notificationTicket)
    .where(lt(notificationTicket.createdAt, new Date(now.getTime() - notifyTiming.receiptMinAgeMs)))
    .orderBy(asc(notificationTicket.createdAt))
    .limit(RECEIPT_BATCH);
  const result = { checked: 0, invalidTokens: 0, errors: 0 };
  if (tickets.length === 0) return result;

  const client = getPushClient();
  const receipts: Awaited<ReturnType<typeof client.getPushNotificationReceiptsAsync>> = {};
  for (const ids of client.chunkPushNotificationReceiptIds(tickets.map((ticket) => ticket.ticketId))) {
    try {
      Object.assign(receipts, await client.getPushNotificationReceiptsAsync(ids));
    } catch (error) {
      log(`lecture des reçus : échec (${code(error)})`);
    }
  }

  const done: string[] = [];
  const invalid = new Set<string>();
  for (const ticket of tickets) {
    const receipt = receipts[ticket.ticketId];
    if (!receipt) {
      // Pas encore de reçu : on réessaiera au prochain passage, sauf s'il est trop vieux.
      if (now.getTime() - ticket.createdAt.getTime() > notifyTiming.receiptMaxAgeMs) done.push(ticket.id);
      continue;
    }
    done.push(ticket.id);
    result.checked += 1;
    if (receipt.status === 'error') {
      result.errors += 1;
      if (receipt.details?.error === 'DeviceNotRegistered') invalid.add(ticket.token);
    }
  }
  await deleteTokens([...invalid]);
  result.invalidTokens = invalid.size;
  if (done.length > 0) await db.delete(notificationTicket).where(inArray(notificationTicket.id, done));
  log(`reçus : ${result.checked} lus, ${result.errors} en erreur, ${result.invalidTokens} jetons supprimés`);
  return result;
}

/**
 * Reprend les jobs `pending` (démarrage de l'API, balayage régulier). Ceux qui ont déjà épuisé
 * leurs tentatives passent à `failed`.
 */
export async function resumePendingJobs(): Promise<{ resumed: number; failed: number }> {
  const { notificationJob } = schema;
  const failedRows = await db
    .update(notificationJob)
    .set({ status: 'failed', errorCode: 'max_attempts', updatedAt: new Date() })
    .where(and(eq(notificationJob.status, 'pending'), gte(notificationJob.attempts, NOTIFICATION_MAX_ATTEMPTS)))
    .returning({ id: notificationJob.id });
  const pending = await db
    .select({ id: notificationJob.id })
    .from(notificationJob)
    .where(eq(notificationJob.status, 'pending'))
    .orderBy(asc(notificationJob.createdAt));
  for (const { id } of pending) await processJob(id);
  if (pending.length > 0 || failedRows.length > 0) {
    log(`reprise : ${pending.length} envois repris, ${failedRows.length} abandonnés`);
  }
  return { resumed: pending.length, failed: failedRows.length };
}

let sweepTimer: ReturnType<typeof setInterval> | undefined;

/** Démarre le travail de fond : reprise des envois et reçus au démarrage, puis toutes les 15 minutes. */
export function startNotifyWorker(): void {
  if (sweepTimer) return;
  const sweep = async () => {
    try {
      await resumePendingJobs();
      await checkReceipts();
    } catch (error) {
      log(`balayage : échec (${code(error)})`);
    }
  };
  void sweep();
  sweepTimer = setInterval(() => void sweep(), notifyTiming.sweepEveryMs);
  sweepTimer.unref();
}

export function stopNotifyWorker(): void {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = undefined;
  cancelScheduledNotifications();
}
