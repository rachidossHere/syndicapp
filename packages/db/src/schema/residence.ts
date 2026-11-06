// Résidences, lots, membres et invitations (plan 04).
// Les rôles et types de lot viennent de @syndic/shared (source unique).
import { LOT_TYPES, ROLES } from '@syndic/shared';
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';

export const memberRole = pgEnum('member_role', ROLES);
export const lotType = pgEnum('lot_type', LOT_TYPES);

/** Dates stockées en UTC (AGENTS.md), avec fuseau explicite. */
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const residence = pgTable('residence', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  address: text('address'),
  createdAt: createdAt(),
});

export const lot = pgTable(
  'lot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    building: text('building'),
    floor: integer('floor'),
    type: lotType('type').notNull().default('apartment'),
    createdAt: createdAt(),
  },
  (table) => [
    // Référence unique par résidence (« B12 »). Sert aussi d'index sur residence_id.
    unique('lot_residence_reference_unique').on(table.residenceId, table.reference),
    // Cible des clés étrangères composites : un membre ou une invitation ne peut viser
    // qu'un lot de sa propre résidence.
    unique('lot_id_residence_unique').on(table.id, table.residenceId),
  ],
);

export const membership = pgTable(
  'membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    role: memberRole('role').notNull(),
    lotId: uuid('lot_id'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'membership_lot_same_residence_fk',
      columns: [table.lotId, table.residenceId],
      foreignColumns: [lot.id, lot.residenceId],
    }).onDelete('restrict'),
    // Un seul syndic (manager) actif par résidence.
    uniqueIndex('membership_one_active_manager_idx')
      .on(table.residenceId)
      .where(sql`${table.role} = 'manager' and ${table.active}`),
    // « Mes résidences » : memberships actifs d'un utilisateur.
    index('membership_user_active_idx').on(table.userId, table.active),
    // Membres d'une résidence.
    index('membership_residence_active_idx').on(table.residenceId, table.active),
    index('membership_lot_idx').on(table.lotId),
    // Un membership terminé est inactif.
    check('membership_ended_inactive', sql`${table.endedAt} is null or not ${table.active}`),
  ],
);

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    // Facultatif : un gardien n'a pas de lot.
    lotId: uuid('lot_id'),
    role: memberRole('role').notNull(),
    code: text('code').notNull().unique('invitation_code_unique'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedBy: text('used_by').references(() => user.id, { onDelete: 'restrict' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'invitation_lot_same_residence_fk',
      columns: [table.lotId, table.residenceId],
      foreignColumns: [lot.id, lot.residenceId],
    }).onDelete('restrict'),
    // Invitations d'une résidence (liste « en attente »).
    index('invitation_residence_idx').on(table.residenceId, table.createdAt),
    index('invitation_lot_idx').on(table.lotId),
    // On n'invite pas un syndic : le rôle se transmet par la passation (plan 09).
    check('invitation_role_not_manager', sql`${table.role} <> 'manager'`),
    // used_at et used_by sont renseignés ensemble.
    check('invitation_used_consistent', sql`(${table.usedAt} is null) = (${table.usedBy} is null)`),
  ],
);
