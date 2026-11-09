// Dépenses et caisse (plan 06) : valeurs en anglais dans le code et la base.
// Les libellés affichés (entretien, ascenseur…) passent par les traductions de l'appli.

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
