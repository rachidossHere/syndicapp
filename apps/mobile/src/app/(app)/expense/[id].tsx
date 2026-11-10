import { useLocalSearchParams } from 'expo-router';

import { ExpenseDetailScreen } from '@/features/accounts/expense-detail-screen';

/** Détail d'une dépense : facture, montant, auteur (par son rôle), annulation. */
export default function ExpenseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseDetailScreen expenseId={id} />;
}
