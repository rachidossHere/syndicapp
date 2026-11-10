// Dépenses et caisse (plan 06) : requêtes et mutations TanStack Query.
// Une dépense enregistrée rafraîchit tout ce qui dépend de la caisse (écran « Comptes », étape 4).
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { expenseDeps } from '@/lib/expense-api';
import { saveExpense, type SaveExpenseArgs } from '@/lib/expense-save';

/** Toutes les données de caisse d'une résidence (solde, journal, dépenses) : invalidées ensemble. */
export const cashQueryKey = (residenceId: string) => ['cash', residenceId] as const;
export const expensesQueryKey = (residenceId: string) => ['expenses', residenceId] as const;

export type NewExpense = Omit<SaveExpenseArgs, 'deps'>;

/** Enregistre une dépense : envoi de la facture vers R2 si besoin, puis création idempotente. */
export function useCreateExpense(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewExpense) => saveExpense({ ...input, deps: expenseDeps }),
    onSuccess: async () => {
      const id = residenceId ?? 'none';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cashQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: expensesQueryKey(id) }),
      ]);
    },
  });
}
