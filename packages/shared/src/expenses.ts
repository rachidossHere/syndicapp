// Dépenses et caisse (plan 06) : valeurs en anglais dans le code et la base.
// Les libellés affichés (entretien, ascenseur…) passent par les traductions de l'appli.
import { z } from 'zod';

import {
  centimesSchema,
  isoDateSchema,
  MAX_AMOUNT_CENTIMES,
  MAX_CANCEL_REASON_LENGTH,
} from './charges';

export const MAX_LEDGER_PAGE_SIZE = 100;
export const DEFAULT_LEDGER_PAGE_SIZE = 20;

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
  invalidFileType: 'expenses.errors.invalidFileType',
  fileTooLarge: 'expenses.errors.fileTooLarge',
  invoiceNotFound: 'expenses.errors.invoiceNotFound',
  openingReasonRequired: 'expenses.errors.openingReasonRequired',
} as const;
export type ExpenseErrorKey = (typeof EXPENSE_ERRORS)[keyof typeof EXPENSE_ERRORS];

/** Types de facture acceptés et taille maximale (10 Mo). */
export const INVOICE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024;

/** Extension de l'objet R2 pour chaque type de facture. */
export const INVOICE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
} as const satisfies Record<(typeof INVOICE_CONTENT_TYPES)[number], string>;

/** Préfixe des clés de factures d'une résidence : residences/<id>/invoices/. */
export const invoiceKeyPrefix = (residenceId: string): string =>
  `residences/${residenceId}/invoices/`;

/** Demande d'URL d'envoi : type et taille sont inclus dans la signature. */
export const invoiceUploadRequestSchema = z
  .object({
    contentType: z.string().trim().min(1).max(100),
    size: z.number().int().positive(),
  })
  .strict();
export type InvoiceUploadRequest = z.infer<typeof invoiceUploadRequestSchema>;

/** Période en cours (bornes incluses, AAAA-MM-JJ) : trimestre ou mois selon la périodicité. */
export function currentPeriodBounds(
  period: 'monthly' | 'quarterly',
  today: string,
): { from: string; to: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const first = period === 'quarterly' ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const last = period === 'quarterly' ? first + 2 : month;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, last, 0)).getUTCDate();
  return { from: `${year}-${pad(first)}-01`, to: `${year}-${pad(last)}-${pad(lastDay)}` };
}

/** Liste des dépenses : pagination. */
export const expenseListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_LEDGER_PAGE_SIZE).default(DEFAULT_LEDGER_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const MAX_EXPENSE_LABEL_LENGTH = 120;
export const MAX_SUPPLIER_LENGTH = 120;

/** Saisie d'une dépense (permission `expenses.write`). `clientId` rend la création idempotente. */
export const createExpenseSchema = z
  .object({
    label: z.string().trim().min(1).max(MAX_EXPENSE_LABEL_LENGTH),
    amount: centimesSchema,
    category: z.enum(EXPENSE_CATEGORIES),
    // AAAA-MM-JJ (fuseau Africa/Casablanca) ; aujourd'hui par défaut. Une date future est refusée par l'API.
    spentOn: isoDateSchema.optional(),
    supplier: z.string().trim().min(1).max(MAX_SUPPLIER_LENGTH).optional(),
    // Clé de la facture déjà envoyée vers R2 ; type et taille sont lus dans R2 par l'API.
    invoiceKey: z.string().trim().min(1).max(300).optional(),
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
