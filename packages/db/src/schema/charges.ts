// Charges, encaissements et reçus (plan 05).
// Montants en centimes (entiers), devise MAD. Aucune suppression physique des paiements et des
// reçus : toutes les clés étrangères sont en `restrict`, l'annulation d'un paiement est tracée.
import { DUE_STATUSES, PAYMENT_METHODS } from '@syndic/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { lot, residence } from './residence';

export const dueStatus = pgEnum('due_status', DUE_STATUSES);
export const paymentMethod = pgEnum('payment_method', PAYMENT_METHODS);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const residenceId = () =>
  uuid('residence_id')
    .notNull()
    .references(() => residence.id, { onDelete: 'restrict' });

/** Appel de charges : une période, un montant par lot (égal pour tous dans le MVP). */
export const chargeCall = pgTable(
  'charge_call',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: residenceId(),
    // « 2026-Q4 » (trimestre) ou « 2026-11 » (mois), selon residence.charge_period.
    periodLabel: text('period_label').notNull(),
    amountPerLot: integer('amount_per_lot').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (table) => [
    // Une seule période par résidence. Sert aussi d'index sur residence_id.
    unique('charge_call_residence_period_unique').on(table.residenceId, table.periodLabel),
    // Cible de la clé étrangère composite de charge_due.
    unique('charge_call_id_residence_unique').on(table.id, table.residenceId),
    check('charge_call_amount_positive', sql`${table.amountPerLot} > 0`),
  ],
);

/** Ce que doit un lot pour un appel de charges. */
export const chargeDue = pgTable(
  'charge_due',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: residenceId(),
    chargeCallId: uuid('charge_call_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    amountDue: integer('amount_due').notNull(),
    amountPaid: integer('amount_paid').notNull().default(0),
    status: dueStatus('status').notNull().default('unpaid'),
  },
  (table) => [
    foreignKey({
      name: 'charge_due_call_same_residence_fk',
      columns: [table.chargeCallId, table.residenceId],
      foreignColumns: [chargeCall.id, chargeCall.residenceId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'charge_due_lot_same_residence_fk',
      columns: [table.lotId, table.residenceId],
      foreignColumns: [lot.id, lot.residenceId],
    }).onDelete('restrict'),
    // Un seul dû par lot et par appel. Sert aussi d'index sur charge_call_id.
    unique('charge_due_call_lot_unique').on(table.chargeCallId, table.lotId),
    // Cible de la clé étrangère composite de payment.
    unique('charge_due_id_residence_unique').on(table.id, table.residenceId),
    // « Mes charges » : dus d'un lot dans une résidence.
    index('charge_due_residence_lot_idx').on(table.residenceId, table.lotId),
    check('charge_due_amount_due_positive', sql`${table.amountDue} > 0`),
    check(
      'charge_due_amount_paid_range',
      sql`${table.amountPaid} >= 0 and ${table.amountPaid} <= ${table.amountDue}`,
    ),
    // Le statut est toujours cohérent avec les montants.
    check(
      'charge_due_status_consistent',
      sql`(${table.status} = 'unpaid' and ${table.amountPaid} = 0)
        or (${table.status} = 'partial' and ${table.amountPaid} > 0 and ${table.amountPaid} < ${table.amountDue})
        or (${table.status} = 'paid' and ${table.amountPaid} = ${table.amountDue})`,
    ),
  ],
);

/** Encaissement. Jamais supprimé : annulé avec qui, quand et un motif obligatoire. */
export const payment = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: residenceId(),
    chargeDueId: uuid('charge_due_id').notNull(),
    amount: integer('amount').notNull(),
    method: paymentMethod('method').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by').references(() => user.id, { onDelete: 'restrict' }),
    cancelReason: text('cancel_reason'),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'payment_due_same_residence_fk',
      columns: [table.chargeDueId, table.residenceId],
      foreignColumns: [chargeDue.id, chargeDue.residenceId],
    }).onDelete('restrict'),
    // Cible de la clé étrangère composite de receipt.
    unique('payment_id_residence_unique').on(table.id, table.residenceId),
    // Paiements d'un dû (recalcul du statut) et d'une résidence (journal des mouvements).
    index('payment_due_idx').on(table.chargeDueId),
    index('payment_residence_paid_at_idx').on(table.residenceId, table.paidAt),
    check('payment_amount_positive', sql`${table.amount} > 0`),
    // Annulation : date et auteur ensemble, motif obligatoire (non vide).
    check(
      'payment_cancelled_by_consistent',
      sql`(${table.cancelledAt} is null) = (${table.cancelledBy} is null)`,
    ),
    check(
      'payment_cancel_reason_required',
      sql`${table.cancelledAt} is null or length(btrim(coalesce(${table.cancelReason}, ''))) > 0`,
    ),
  ],
);

/** Reçu PDF d'un paiement (le fichier vit dans R2 : `storage_key`, renseignée à l'étape 3). */
export const receipt = pgTable(
  'receipt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    residenceId: residenceId(),
    paymentId: uuid('payment_id').notNull(),
    // « 2026-0042 » : année, puis numéro continu dans la résidence.
    number: text('number').notNull(),
    storageKey: text('storage_key'),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'receipt_payment_same_residence_fk',
      columns: [table.paymentId, table.residenceId],
      foreignColumns: [payment.id, payment.residenceId],
    }).onDelete('restrict'),
    // Un reçu par paiement.
    unique('receipt_payment_unique').on(table.paymentId),
    // Numéro unique par résidence (le même numéro peut exister dans une autre résidence).
    unique('receipt_residence_number_unique').on(table.residenceId, table.number),
    check('receipt_number_format', sql`${table.number} ~ '^[0-9]{4}-[0-9]{4,}$'`),
  ],
);

/**
 * Compteur de numéros de reçu, par résidence et par année. Incrémenté dans la transaction qui
 * crée le reçu, par `nextReceiptNumber` (receipt-number.ts) : l'UPSERT verrouille la ligne,
 * donc deux encaissements simultanés ne reçoivent jamais le même numéro.
 */
export const receiptCounter = pgTable(
  'receipt_counter',
  {
    residenceId: residenceId(),
    year: integer('year').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (table) => [
    primaryKey({ name: 'receipt_counter_pk', columns: [table.residenceId, table.year] }),
    check('receipt_counter_last_number_nonneg', sql`${table.lastNumber} >= 0`),
  ],
);
