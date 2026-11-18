// Annonces de la résidence (plan 08, étape 3). Pas de modification ni de suppression dans cette
// étape (seulement épingler et désépingler) : clés étrangères en `restrict`, aucune suppression
// physique. Le texte de la notification ne reprend jamais le titre ni le contenu.
import { ANNOUNCEMENT_CATEGORIES, MAX_ANNOUNCEMENT_BODY_LENGTH, MAX_ANNOUNCEMENT_TITLE_LENGTH } from '@syndic/shared';
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { residence } from './residence';

export const announcementCategory = pgEnum('announcement_category', ANNOUNCEMENT_CATEGORIES);

export const announcement = pgTable(
  'announcement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    category: announcementCategory('category').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    // Date d'épinglage : renseignée si et seulement si l'annonce est épinglée.
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Liste d'une résidence : épinglées d'abord, puis les plus récentes ; « dernière annonce ».
    index('announcement_residence_list_idx').on(table.residenceId, table.pinned, table.createdAt),
    check('announcement_title_length', sql`length(btrim(${table.title})) between 1 and ${sql.raw(String(MAX_ANNOUNCEMENT_TITLE_LENGTH))}`),
    check('announcement_body_length', sql`length(btrim(${table.body})) between 1 and ${sql.raw(String(MAX_ANNOUNCEMENT_BODY_LENGTH))}`),
    check('announcement_pinned_at_consistent', sql`(${table.pinned}) = (${table.pinnedAt} is not null)`),
  ],
);
