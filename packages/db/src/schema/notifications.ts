// Notifications push (plan 08, étape 1). Ces deux tables sont liées à l'utilisateur, pas à une
// résidence (décision du plan 08) : un téléphone et ses réglages suivent la personne.
import {
  DEFAULT_PUSH_LOCALE,
  NOTIFICATION_JOB_STATUSES,
  NOTIFICATION_TYPES,
  PUSH_LOCALES,
  type NotificationAudience,
  type NotificationData,
} from '@syndic/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { residence } from './residence';

export const notificationType = pgEnum('notification_type', NOTIFICATION_TYPES);
export const pushLocale = pgEnum('push_locale', PUSH_LOCALES);
export const notificationJobStatus = pgEnum('notification_job_status', NOTIFICATION_JOB_STATUSES);

/** Jeton Expo d'un téléphone. Unique : un jeton appartient à un seul utilisateur à la fois. */
export const pushToken = pgTable(
  'push_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    device: text('device'),
    // Langue de l'appli sur ce téléphone : choisit le texte des notifications (fr par défaut).
    locale: pushLocale('locale').notNull().default(DEFAULT_PUSH_LOCALE),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('push_token_user_idx').on(table.userId)],
);

/** Préférence d'un utilisateur pour un type. Absence de ligne = activé. */
export const notificationPreference = pgTable(
  'notification_preference',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
);

/**
 * Notification à envoyer, enregistrée par `notify` (dans la transaction métier) puis traitée après
 * la réponse. Les données de navigation ne contiennent que l'identifiant de l'élément concerné.
 * Pas de suppression physique : clé étrangère en `restrict`.
 */
export const notificationJob = pgTable(
  'notification_job',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    type: notificationType('type').notNull(),
    audience: jsonb('audience').$type<NotificationAudience>().notNull(),
    data: jsonb('data').$type<NotificationData>().notNull().default({}),
    status: notificationJobStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    // Code d'erreur de la dernière tentative ratée (jamais de message ni de contenu).
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    // Reprise au démarrage : les envois en attente.
    index('notification_job_status_idx').on(table.status, table.createdAt),
    index('notification_job_residence_idx').on(table.residenceId),
  ],
);

/**
 * Ticket renvoyé par Expo à l'envoi : son reçu se lit plus tard (au démarrage et toutes les
 * 15 minutes). La ligne est supprimée une fois le reçu lu. Le jeton n'a pas de clé étrangère : il
 * peut avoir été supprimé entre-temps. Sert aussi à ne pas renvoyer deux fois au même jeton
 * lors d'une nouvelle tentative du même envoi.
 */
export const notificationTicket = pgTable(
  'notification_ticket',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => notificationJob.id, { onDelete: 'cascade' }),
    ticketId: text('ticket_id').notNull().unique(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_ticket_job_token_unique').on(table.jobId, table.token),
    index('notification_ticket_created_idx').on(table.createdAt),
  ],
);
