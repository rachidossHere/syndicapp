// Charges et encaissements (plan 05) : valeurs en anglais dans le code et la base.
// Les libellés affichés (payé, espèces…) passent par les traductions de l'appli : ce fichier
// ne contient que les clés de traduction, ajoutées à fr.ts et ar.ts avec les écrans (étape 4).
import { z } from 'zod';

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

/** Clés de traduction des libellés affichés (payé, partiel, impayé ; espèces, virement…). */
export const CHARGE_PERIOD_LABEL_KEYS: Record<ChargePeriod, string> = {
  monthly: 'charges.period.monthly',
  quarterly: 'charges.period.quarterly',
};
export const DUE_STATUS_LABEL_KEYS: Record<DueStatus, string> = {
  paid: 'charges.status.paid',
  partial: 'charges.status.partial',
  unpaid: 'charges.status.unpaid',
};
export const PAYMENT_METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
  cash: 'charges.method.cash',
  transfer: 'charges.method.transfer',
};

/** Plafond d'un montant (centimes) : 10 millions de MAD, bien en dessous de l'entier Postgres. */
export const MAX_AMOUNT_CENTIMES = 1_000_000_000;
/** Longueur maximale du motif d'annulation d'un paiement. */
export const MAX_CANCEL_REASON_LENGTH = 500;

/** Montant en centimes : entier strictement positif, jamais de nombre à virgule. */
export const centimesSchema = z.number().int().positive().max(MAX_AMOUNT_CENTIMES);

/** Date au format AAAA-MM-JJ, réellement existante (pas de 2026-02-31). */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  });

/** Libellé de période : « 2026-Q4 » (trimestre) ou « 2026-M11 » (mois). */
export const periodLabelSchema = z.string().regex(/^\d{4}-(Q[1-4]|M(0[1-9]|1[0-2]))$/);

/** Création d'un appel de charges (permission `charges.write`). */
export const createChargeCallSchema = z
  .object({
    periodLabel: periodLabelSchema,
    amountPerLot: centimesSchema,
    dueDate: isoDateSchema,
  })
  .strict();
export type CreateChargeCallInput = z.infer<typeof createChargeCallSchema>;

/** Encaissement (permission `payments.write`). */
export const createPaymentSchema = z
  .object({
    chargeDueId: z.uuid(),
    amount: centimesSchema,
    method: z.enum(PAYMENT_METHODS),
  })
  .strict();
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** Annulation d'un paiement : motif obligatoire. */
export const cancelPaymentSchema = z
  .object({ reason: z.string().trim().min(1).max(MAX_CANCEL_REASON_LENGTH) })
  .strict();
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;

/** Statut d'un dû à partir des montants (centimes) : la même règle que la contrainte en base. */
export function computeDueStatus(amountPaid: number, amountDue: number): DueStatus {
  if (amountPaid <= 0) return 'unpaid';
  return amountPaid >= amountDue ? 'paid' : 'partial';
}
