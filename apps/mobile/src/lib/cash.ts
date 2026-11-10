// Comptes (plan 06, étape 4) : règles pures des écrans « Comptes », « Détail d'une dépense » et
// « Solde de départ ». Sans React : testables avec vitest.
import {
  can,
  setOpeningBalanceSchema,
  type Role,
  type SetOpeningBalanceInput,
} from '@syndic/shared';

import { parseMadInput } from './charges-format';

/** Un mouvement du journal (GET /api/cash). Montant en centimes, toujours positif. */
export type LedgerEntry = {
  kind: 'payment' | 'expense';
  id: string;
  date: string;
  direction: 'in' | 'out';
  amount: number;
  label: string;
  lotReference: string | null;
  category: string | null;
  hasInvoice: boolean;
  cancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
};

/** Résidence active, telle que la connaît l'appli. */
type ActiveResidence = { id: string; role: Role } | null | undefined;

/** « Comptes » : tous les rôles qui ont `accounts.read` (syndic, trésorier, adjoint, copropriétaire). */
export const canSeeAccounts = (role: Role): boolean => can(role, 'accounts.read');

/**
 * Résidence pour laquelle charger les comptes. `undefined` désactive la requête : un locataire ou
 * un gardien n'appelle jamais /api/cash ni /api/expenses.
 */
export const accountsResidenceId = (active: ActiveResidence): string | undefined =>
  active && canSeeAccounts(active.role) ? active.id : undefined;

/** Annuler une dépense : `expenses.write` (syndic, trésorier). Le copropriétaire ne peut rien annuler. */
export const canCancelExpense = (role: Role): boolean => can(role, 'expenses.write');

/** Solde de départ : réservé au syndic (`residence.manage`). */
export const canSetOpeningBalance = (role: Role): boolean => can(role, 'residence.manage');

/** Résidence pour laquelle charger le solde de départ et son historique (syndic seulement). */
export const openingBalanceResidenceId = (active: ActiveResidence): string | undefined =>
  active && canSetOpeningBalance(active.role) ? active.id : undefined;

/** Présentation d'un mouvement : signe, couleur (sens) et badges. Le sens vient de l'API. */
export type LedgerView = {
  direction: 'in' | 'out';
  /** Signe affiché dans la pastille (jamais la couleur seule). */
  sign: '+' | '−';
  /** Pastille « Sans facture » : une dépense sans facture. */
  noInvoice: boolean;
  /** Pastille « Annulée ». */
  cancelled: boolean;
  /** Seules les dépenses ouvrent un détail ; les paiements ne sont pas cliquables pour l'instant. */
  opensDetail: boolean;
};

export function ledgerView(entry: LedgerEntry): LedgerView {
  return {
    direction: entry.direction,
    sign: entry.direction === 'in' ? '+' : '−',
    noInvoice: entry.kind === 'expense' && !entry.hasInvoice,
    cancelled: entry.cancelled,
    opensDetail: entry.kind === 'expense',
  };
}

/** Isole une référence d'appartement (A21, B12) : elle reste de gauche à droite, même en arabe. */
export const ltrIsolate = (text: string): string => `⁦${text}⁩`;

/** Taille d'un fichier : { n, unit } pour « 412 Ko » ou « 1,2 Mo ». */
export function fileSize(bytes: number): { value: string; unit: 'kb' | 'mb' } {
  if (bytes < 1024 * 1024) return { value: String(Math.max(1, Math.round(bytes / 1024))), unit: 'kb' };
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return { value: String(mb).replace('.', ','), unit: 'mb' };
}

/** Une facture est une image (aperçu) sauf si c'est un PDF. */
export const isPdf = (contentType: string | null): boolean => contentType === 'application/pdf';

/** Durée maximale de conservation d'une URL signée de facture dans le cache : 4 minutes (elle vit 5). */
export const INVOICE_URL_MAX_CACHE_MS = 4 * 60 * 1000;

/** Annulation d'une dépense : le motif est obligatoire (sans espaces autour). */
export function validateCancelReason(
  reason: string,
): { ok: true; reason: string } | { ok: false; errorKey: 'expenses.errors.cancelReasonRequired' } {
  const trimmed = reason.trim();
  return trimmed.length === 0
    ? { ok: false, errorKey: 'expenses.errors.cancelReasonRequired' }
    : { ok: true, reason: trimmed };
}

/** Montant du solde de départ en centimes : « 0 » est permis (caisse vide), contrairement à une dépense. */
export function parseOpeningAmount(text: string): number | undefined {
  if (/^0+([.,]0{1,2})?$/.test(text.replace(/[\s  ]/g, ''))) return 0;
  return parseMadInput(text);
}

export type OpeningFormValues = { amount: string; asOfDate: string; reason: string };
export type OpeningFormErrors = Partial<Record<'amount' | 'asOfDate' | 'reason', string>>;

/**
 * Valide la saisie du solde de départ avec le schéma partagé. Une première saisie n'a pas de
 * motif ; une correction (`isCorrection`) en exige un. Les erreurs sont des clés de traduction.
 */
export function validateOpeningBalance(
  values: OpeningFormValues,
  isCorrection: boolean,
): { ok: true; input: SetOpeningBalanceInput } | { ok: false; errors: OpeningFormErrors } {
  const errors: OpeningFormErrors = {};
  const amount = parseOpeningAmount(values.amount);
  if (amount === undefined) errors.amount = 'expenses.errors.amountInvalid';
  const reason = values.reason.trim();
  if (isCorrection && reason.length === 0) errors.reason = 'expenses.errors.openingReasonRequired';

  const parsed = setOpeningBalanceSchema.safeParse({
    amount: amount ?? Number.NaN,
    asOfDate: values.asOfDate,
    ...(isCorrection && reason.length > 0 ? { reason } : {}),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'asOfDate') errors.asOfDate = 'expenses.errors.dateInvalid';
      if (issue.path[0] === 'reason') errors.reason ??= 'expenses.errors.openingReasonRequired';
    }
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, input: parsed.data };
}
