// Bornes des sélecteurs de date, selon l'usage. Fonctions pures (sans React) : testables avec vitest.
// Les dates sont des chaînes AAAA-MM-JJ ; « aujourd'hui » est la date de Casablanca.

/** Les trois sélecteurs de date de l'appli. */
export const DATE_USAGES = ['chargeDue', 'expense', 'openingBalance'] as const;
export type DateUsage = (typeof DATE_USAGES)[number];

export type DateBounds = {
  /** Première date sélectionnable (incluse). */
  minimum?: string;
  /** Dernière date sélectionnable (incluse). */
  maximum?: string;
};

/**
 * - échéance d'un appel de charges : aujourd'hui ou plus tard ;
 * - date d'une dépense : aujourd'hui ou plus tôt ;
 * - date du solde de départ : aujourd'hui ou plus tôt.
 */
export function dateBoundsFor(usage: DateUsage, today: string): DateBounds {
  switch (usage) {
    case 'chargeDue':
      return { minimum: today };
    case 'expense':
    case 'openingBalance':
      return { maximum: today };
  }
}

/** La date respecte-t-elle les bornes de l'usage ? */
export function isDateAllowed(usage: DateUsage, date: string, today: string): boolean {
  const { minimum, maximum } = dateBoundsFor(usage, today);
  if (minimum !== undefined && date < minimum) return false;
  if (maximum !== undefined && date > maximum) return false;
  return true;
}
