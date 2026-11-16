// Notifications push (plan 08, étape 1). Ces deux tables sont liées à l'utilisateur, pas à une
// résidence (décision du plan 08) : un téléphone et ses réglages suivent la personne.
import { NOTIFICATION_TYPES } from '@syndic/shared';
import { boolean, index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const notificationType = pgEnum('notification_type', NOTIFICATION_TYPES);

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
