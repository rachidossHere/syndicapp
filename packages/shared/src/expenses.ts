// Dépenses et caisse (plan 06) : valeurs en anglais dans le code et la base.
// Les libellés affichés (entretien, ascenseur…) passent par les traductions de l'appli.
import { z } from 'zod';

import {
  centimesSchema,
  isoDateSchema,
  MAX_AMOUNT_CENTIMES,
  MAX_CANCEL_REASON_LENGTH,
} from './charges';

/** Catégories de dépenses : liste fixe. */
export const EXPENSE_CATEGORIES = [
  'maintenance',
  'elevator',
  'electricity',
  'water',
  'cleaning',
  'security',
  'repairs',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Libellé d'un encaissement dans le journal : « Charge reçue · B12 », jamais le nom du payeur. */
export const PAYMENT_LEDGER_LABEL = 'Charge reçue';
export function formatPaymentLedgerLabel(lotReference: string): string {
  return `${PAYMENT_LEDGER_LABEL} · ${lotReference}`;
}

/** Clés de traduction des libellés de catégories (entretien, ascenseur, électricité…). */
export const EXPENSE_CATEGORY_LABEL_KEYS: Record<ExpenseCategory, string> = {
  maintenance: 'expenses.category.maintenance',
  elevator: 'expenses.category.elevator',
  electricity: 'expenses.category.electricity',
  water: 'expenses.category.water',
  cleaning: 'expenses.category.cleaning',
  security: 'expenses.category.security',
  repairs: 'expenses.category.repairs',
  other: 'expenses.category.other',
};

/** Clés de traduction des refus de l'API des dépenses (réponse `{ error: <clé> }`). */
export const EXPENSE_ERRORS = {
  notFound: 'expenses.errors.notFound',
  alreadyCancelled: 'expenses.errors.alreadyCancelled',
  cancelReasonRequired: 'expenses.errors.cancelReasonRequired',
  dateInFuture: 'expenses.errors.dateInFuture',
  invoiceTypeInvalid: 'expenses.errors.invoiceTypeInvalid',
  invoiceTooLarge: 'expenses.errors.invoiceTooLarge',
  openingBalanceReasonRequired: 'expenses.errors.openingBalanceReasonRequired',
} as const;
export type ExpenseErrorKey = (typeof EXPENSE_ERRORS)[keyof typeof EXPENSE_ERRORS];

/** Types de facture acceptés et taille maximale (10 Mo). */
export const INVOICE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024;

export const MAX_EXPENSE_LABEL_LENGTH = 120;
export const MAX_SUPPLIER_LENGTH = 120;

/** Facture déjà envoyée vers R2 : clé de l'objet, type et taille vérifiés par l'API. */
export const expenseInvoiceSchema = z
  .object({
    key: z.string().trim().min(1).max(300),
    contentType: z.enum(INVOICE_CONTENT_TYPES),
    size: z.number().int().positive().max(MAX_INVOICE_SIZE_BYTES),
  })
  .strict();

/** Saisie d'une dépense (permission `expenses.write`). `clientId` rend la création idempotente. */
export const createExpenseSchema = z
  .object({
    label: z.string().trim().min(1).max(MAX_EXPENSE_LABEL_LENGTH),
    amount: centimesSchema,
    category: z.enum(EXPENSE_CATEGORIES),
    // AAAA-MM-JJ (fuseau Africa/Casablanca) ; aujourd'hui par défaut. Une date future est refusée par l'API.
    spentOn: isoDateSchema.optional(),
    supplier: z.string().trim().min(1).max(MAX_SUPPLIER_LENGTH).optional(),
    invoice: expenseInvoiceSchema.optional(),
    clientId: z.uuid().optional(),
  })
  .strict();
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/** Annulation d'une dépense : motif obligatoire. */
export const cancelExpenseSchema = z
  .object({ reason: z.string().trim().min(1).max(MAX_CANCEL_REASON_LENGTH) })
  .strict();
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;

/**
 * Solde de départ (permission `residence.manage`). Le motif est obligatoire dès qu'il s'agit
 * d'une correction : l'API le vérifie, car elle seule sait s'il existe déjà une saisie.
 */
export const setOpeningBalanceSchema = z
  .object({
    amount: z.number().int().min(0).max(MAX_AMOUNT_CENTIMES),
    asOfDate: isoDateSchema,
    reason: z.string().trim().min(1).max(MAX_CANCEL_REASON_LENGTH).optional(),
  })
  .strict();
export type SetOpeningBalanceInput = z.infer<typeof setOpeningBalanceSchema>;

/** Journal des mouvements : période (bornes incluses) et pagination. */
export const MAX_LEDGER_PAGE_SIZE = 100;
export const DEFAULT_LEDGER_PAGE_SIZE = 20;
export const ledgerQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LEDGER_PAGE_SIZE).default(DEFAULT_LEDGER_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to);
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
