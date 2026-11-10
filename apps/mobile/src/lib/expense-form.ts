// Formulaire « Nouvelle dépense » : saisie → schéma Zod partagé (createExpenseSchema).
// Le montant saisi en dirhams devient des centimes avant la validation ; chaque erreur est une
// clé de traduction (expenses.errors.*), jamais un texte.
import {
  createExpenseSchema,
  type CreateExpenseInput,
  type ExpenseCategory,
} from '@syndic/shared';

import { parseMadInput } from './charges-format';

/** Valeurs du formulaire : tout est du texte, sauf la catégorie (choisie parmi les puces). */
export type ExpenseFormValues = {
  label: string;
  amount: string;
  spentOn: string;
  category: ExpenseCategory | '';
};

/** Erreurs propres au formulaire (en plus de EXPENSE_ERRORS, renvoyées par l'API). */
export const EXPENSE_FORM_ERRORS = {
  labelRequired: 'expenses.errors.labelRequired',
  labelTooLong: 'expenses.errors.labelTooLong',
  amountInvalid: 'expenses.errors.amountInvalid',
  categoryRequired: 'expenses.errors.categoryRequired',
  dateInvalid: 'expenses.errors.dateInvalid',
  dateInFuture: 'expenses.errors.dateInFuture',
  uploadFailed: 'expenses.errors.uploadFailed',
  pdfTooLarge: 'expenses.errors.pdfTooLarge',
  cameraDenied: 'expenses.errors.cameraDenied',
  pickFailed: 'expenses.errors.pickFailed',
} as const;

type Issue = { path: readonly PropertyKey[]; message: string; code: string };
type Fields = Omit<CreateExpenseInput, 'invoiceKey' | 'clientId'>;

/** Clé d'erreur d'un champ du schéma partagé. */
function issueKey(issue: Issue): string {
  switch (issue.path[0]) {
    case 'label':
      return issue.code === 'too_big' ? EXPENSE_FORM_ERRORS.labelTooLong : EXPENSE_FORM_ERRORS.labelRequired;
    case 'amount':
      return EXPENSE_FORM_ERRORS.amountInvalid;
    case 'category':
      return EXPENSE_FORM_ERRORS.categoryRequired;
    case 'spentOn':
      return EXPENSE_FORM_ERRORS.dateInvalid;
    default:
      return EXPENSE_FORM_ERRORS.amountInvalid;
  }
}

/**
 * Schéma du formulaire, au format attendu par `schemaResolver` : valide la saisie avec
 * `createExpenseSchema` de @syndic/shared (aucune règle dupliquée), puis traduit les erreurs en clés.
 * `today` (AAAA-MM-JJ, Casablanca) : une date future est refusée comme le fait l'API.
 */
export function expenseFormSchema(today: string) {
  return {
    safeParse(input: unknown):
      | { success: true; data: ExpenseFormValues }
      | { success: false; error: { issues: Issue[] } } {
      const values = input as ExpenseFormValues;
      const parsed = createExpenseSchema.safeParse({
        label: values.label,
        // Un montant illisible devient NaN : refusé par le schéma (entier de centimes > 0).
        amount: parseMadInput(values.amount) ?? Number.NaN,
        category: values.category === '' ? undefined : values.category,
        spentOn: values.spentOn,
      });
      const issues: Issue[] = parsed.success
        ? []
        : parsed.error.issues.map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issueKey({ path: issue.path, code: issue.code, message: issue.message }),
          }));
      if (parsed.success && parsed.data.spentOn !== undefined && parsed.data.spentOn > today) {
        issues.push({ path: ['spentOn'], code: 'custom', message: EXPENSE_FORM_ERRORS.dateInFuture });
      }
      return issues.length === 0 ? { success: true, data: values } : { success: false, error: { issues } };
    },
  };
}

/** Saisie validée → champs de la dépense (montant en centimes). `undefined` si elle est invalide. */
export function expenseFieldsFrom(values: ExpenseFormValues, today: string): Fields | undefined {
  if (!expenseFormSchema(today).safeParse(values).success) return undefined;
  const amount = parseMadInput(values.amount);
  if (amount === undefined || values.category === '') return undefined;
  return {
    label: values.label.trim(),
    amount,
    category: values.category,
    spentOn: values.spentOn,
  };
}

