// Charges et encaissements (plan 05) : valeurs en anglais dans le code et la base.
// Les libellés affichés (mensuel, trimestriel…) passent par les traductions de l'appli.

/** Périodicité des appels de charges, choisie à la création de la résidence. */
export const CHARGE_PERIODS = ['monthly', 'quarterly'] as const;
export type ChargePeriod = (typeof CHARGE_PERIODS)[number];
export const DEFAULT_CHARGE_PERIOD: ChargePeriod = 'quarterly';

/** Statut d'un dû : calculé, mis à jour dans la même transaction que le paiement qui le change. */
export const DUE_STATUSES = ['paid', 'partial', 'unpaid'] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

/** Mode de paiement d'un encaissement (paiement en ligne hors périmètre du MVP). */
export const PAYMENT_METHODS = ['cash', 'transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
