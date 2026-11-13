// Signalements de la résidence (plan 07) et leur historique.
// Aucune suppression physique : clés étrangères en `restrict`. Clés étrangères composites
// (…, residence_id) : un événement ne peut viser qu'un signalement de sa résidence, et l'appartement
// de l'auteur qu'un lot de sa résidence.
import { ISSUE_EVENT_TYPES, ISSUE_LOCATIONS, ISSUE_STATUSES } from '@syndic/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { lot, residence } from './residence';

export const issueStatus = pgEnum('issue_status', ISSUE_STATUSES);
export const issueLocation = pgEnum('issue_location', ISSUE_LOCATIONS);
export const issueEventType = pgEnum('issue_event_type', ISSUE_EVENT_TYPES);

export const issue = pgTable(
  'issue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description'),
    location: issueLocation('location').notNull(),
    urgent: boolean('urgent').notNull().default(false),
    status: issueStatus('status').notNull().default('open'),
    // Photo dans R2 (facultative) : clé de l'objet, type et taille du fichier.
    photoKey: text('photo_key'),
    photoContentType: text('photo_content_type'),
    photoSize: integer('photo_size'),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    // Lot de l'auteur au moment du signalement (facultatif : syndic, gardien… n'en ont pas toujours).
    authorLotId: uuid('author_lot_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'issue_author_lot_same_residence_fk',
      columns: [table.authorLotId, table.residenceId],
      foreignColumns: [lot.id, lot.residenceId],
    }).onDelete('restrict'),
    // Cible de la clé étrangère composite de issue_event.
    unique('issue_id_residence_unique').on(table.id, table.residenceId),
    // Liste d'une résidence filtrée par statut, urgents d'abord.
    index('issue_residence_status_urgent_idx').on(table.residenceId, table.status, table.urgent),
    check('issue_title_not_blank', sql`length(btrim(${table.title})) > 0`),
    // Photo : clé et type ensemble, taille positive.
    check(
      'issue_photo_consistent',
      sql`(${table.photoKey} is null) = (${table.photoContentType} is null)
        and (${table.photoKey} is not null or ${table.photoSize} is null)
        and (${table.photoSize} is null or ${table.photoSize} > 0)`,
    ),
    // La date de résolution existe si et seulement si le signalement est résolu.
    check(
      'issue_resolved_at_consistent',
      sql`(${table.status} = 'resolved') = (${table.resolvedAt} is not null)`,
    ),
  ],
);

/** Historique d'un signalement : création, changement de statut, commentaire, réouverture. */
export const issueEvent = pgTable(
  'issue_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    issueId: uuid('issue_id').notNull(),
    type: issueEventType('type').notNull(),
    fromStatus: issueStatus('from_status'),
    toStatus: issueStatus('to_status'),
    message: text('message'),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'issue_event_issue_same_residence_fk',
      columns: [table.issueId, table.residenceId],
      foreignColumns: [issue.id, issue.residenceId],
    }).onDelete('restrict'),
    // Historique d'un signalement, dans l'ordre.
    index('issue_event_issue_created_at_idx').on(table.issueId, table.createdAt),
    check('issue_event_message_not_blank', sql`${table.message} is null or length(btrim(${table.message})) > 0`),
    // Un commentaire a un message ; un changement de statut a son nouveau statut.
    check('issue_event_comment_has_message', sql`${table.type} <> 'comment' or ${table.message} is not null`),
    check(
      'issue_event_status_has_to_status',
      sql`${table.type} not in ('status_changed', 'reopened', 'created') or ${table.toStatus} is not null`,
    ),
  ],
);
