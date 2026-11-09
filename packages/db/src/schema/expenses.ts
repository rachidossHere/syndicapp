// Dépenses de la résidence (plan 06). Montants en centimes (entiers), devise MAD.
// Aucune suppression physique : clés étrangères en `restrict`, annulation tracée (qui, quand, motif).
import { EXPENSE_CATEGORIES } from '@syndic/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
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
import { residence } from './residence';

export const expenseCategory = pgEnum('expense_category', EXPENSE_CATEGORIES);

export const expense = pgTable(
  'expense',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: uuid('residence_id')
      .notNull()
      .references(() => residence.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    amount: integer('amount').notNull(),
    category: expenseCategory('category').notNull(),
    spentOn: date('spent_on', { mode: 'string' }).notNull(),
    supplier: text('supplier'),
    // Facture dans R2 (facultative) : clé de l'objet, type et taille du fichier.
    invoiceKey: text('invoice_key'),
    invoiceContentType: text('invoice_content_type'),
    invoiceSize: integer('invoice_size'),
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by').references(() => user.id, { onDelete: 'restrict' }),
    cancelReason: text('cancel_reason'),
    // Identifiant généré par l'appli : rend la création idempotente (mode hors ligne, plan 10).
    clientId: uuid('client_id'),
  },
  (table) => [
    // Dépenses et journal d'une résidence, par date.
    index('expense_residence_spent_on_idx').on(table.residenceId, table.spentOn),
    // Un client_id par résidence (plusieurs lignes sans client_id restent permises).
    unique('expense_residence_client_id_unique').on(table.residenceId, table.clientId),
    check('expense_amount_positive', sql`${table.amount} > 0`),
    check('expense_label_not_blank', sql`length(btrim(${table.label})) > 0`),
    // Facture : clé et type ensemble, taille positive.
    check(
      'expense_invoice_consistent',
      sql`(${table.invoiceKey} is null) = (${table.invoiceContentType} is null)
        and (${table.invoiceKey} is not null or ${table.invoiceSize} is null)
        and (${table.invoiceSize} is null or ${table.invoiceSize} > 0)`,
    ),
    // Annulation : date et auteur ensemble, motif obligatoire (non vide).
    check(
      'expense_cancelled_by_consistent',
      sql`(${table.cancelledAt} is null) = (${table.cancelledBy} is null)`,
    ),
    check(
      'expense_cancel_reason_required',
      sql`${table.cancelledAt} is null or length(btrim(coalesce(${table.cancelReason}, ''))) > 0`,
    ),
  ],
);
