import { EXPENSE_ERRORS, type ExpenseErrorKey } from '@syndic/shared';

/** Statut HTTP de chaque refus de l'API des dépenses. */
export const EXPENSE_ERROR_STATUS = {
  [EXPENSE_ERRORS.notFound]: 404,
  [EXPENSE_ERRORS.alreadyCancelled]: 409,
  [EXPENSE_ERRORS.cancelReasonRequired]: 400,
  [EXPENSE_ERRORS.dateInFuture]: 400,
  [EXPENSE_ERRORS.invalidFileType]: 400,
  [EXPENSE_ERRORS.fileTooLarge]: 400,
  [EXPENSE_ERRORS.invoiceNotFound]: 400,
  [EXPENSE_ERRORS.openingReasonRequired]: 400,
} as const satisfies Record<ExpenseErrorKey, 400 | 404 | 409>;

/** Réponse de refus `{ error: <clé de traduction> }`. */
export const expenseRefusal = (key: ExpenseErrorKey, status?: 400 | 404 | 409) =>
  Response.json({ error: key }, { status: status ?? EXPENSE_ERROR_STATUS[key] });
