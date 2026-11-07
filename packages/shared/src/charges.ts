// Charges et encaissements (plan 05) : valeurs en anglais dans le code et la base.
// Les libellés affichés (mensuel, trimestriel…) passent par les traductions de l'appli.

/** Périodicité des appels de charges, choisie à la création de la résidence. */
export const CHARGE_PERIODS = ['monthly', 'quarterly'] as const;
export type ChargePeriod = (typeof CHARGE_PERIODS)[number];
export const DEFAULT_CHARGE_PERIOD: ChargePeriod = 'quarterly';
