// Résumés par période ou par bâtiment (plan 02b, étape 5) : les écrans en accordéons affichent, sur
// chaque section fermée, un résumé exact (nombre, total, statut) sans en charger les éléments.
// Chaque résumé a sa route ; les listes existantes reçoivent un filtre de période (année ou mois).
import { z } from 'zod';

import { ANNOUNCEMENT_CATEGORIES } from './announcements';
import { yearSchema } from './charges';

/** Clé de la section « Sans bâtiment » dans l'adresse (`?building=-`) : jamais un nom de bâtiment. */
export const NO_BUILDING_PARAM = '-';

const buildingParamSchema = z
  .string()
  .trim()
  .regex(/^([A-Za-z0-9]{1,4}|-)$/)
  .transform((value) => (value === NO_BUILDING_PARAM ? value : value.toUpperCase()));

// --- Appels de charges (syndic, trésorier, adjoint : accounts.read) --------------------------------

/** GET /api/charge-calls/summary?groupBy=year */
export const chargeCallSummaryQuerySchema = z.object({ groupBy: z.literal('year') }).strict();

/** GET /api/charge-calls?year=2026 : les appels d'une année (tous si absent). */
export const chargeCallListQuerySchema = z.object({ year: yearSchema.optional() }).strict();

/** Une année d'appels : nombre d'appels, encaissé, et lots qui n'ont pas tout payé (impayés ou partiels). */
export type ChargeCallYearSummary = {
  year: string;
  callCount: number;
  /** Centimes dus et encaissés sur l'année. */
  totalDue: number;
  totalPaid: number;
  /** Dus impayés ou partiels : 0 = année soldée. */
  unpaidCount: number;
};
export type ChargeCallSummaryResponse = { years: ChargeCallYearSummary[] };

// --- Impayés d'un appel (encaisseurs : payments.write) ---------------------------------------------

/** GET /api/charge-calls/:id/summary?groupBy=building */
export const chargeCallBuildingSummaryQuerySchema = z.object({ groupBy: z.literal('building') }).strict();

/** GET /api/charge-calls/:id?building=A&unpaid=true : les lots d'un bâtiment, les impayés seulement. */
export const chargeCallDetailQuerySchema = z
  .object({ building: buildingParamSchema.optional(), unpaid: z.literal('true').optional() })
  .strict();

/** Un bâtiment : lots impayés ou partiels et reste à payer. `building` est nul pour « Sans bâtiment ». */
export type UnpaidBuildingSummary = {
  building: string | null;
  unpaidCount: number;
  /** Centimes restant à encaisser. */
  remaining: number;
  /** Lots que « Relancer » relancerait maintenant (syndic seulement : charges.write). */
  remindableCount?: number;
};
export type UnpaidSummaryResponse = { buildings: UnpaidBuildingSummary[] };

// --- Mes charges (accounts.read) -----------------------------------------------------------------

/** GET /api/me/dues/summary?groupBy=year */
export const myDuesSummaryQuerySchema = z.object({ groupBy: z.literal('year') }).strict();

/** GET /api/me/dues?year=2026 */
export const myDuesListQuerySchema = z.object({ year: yearSchema.optional() }).strict();

/** Une année de mes dus : « N payés sur M » et le total payé (centimes). */
export type MyDuesYearSummary = { year: string; dueCount: number; paidCount: number; totalPaid: number };
export type MyDuesSummaryResponse = { years: MyDuesYearSummary[] };

// --- Mouvements de la caisse (accounts.read) ---------------------------------------------------------

/** GET /api/cash/movements/summary?groupBy=month */
export const ledgerSummaryQuerySchema = z.object({ groupBy: z.literal('month') }).strict();

/** Un mois du journal : nombre de mouvements (annulés compris), encaissé et dépensé (non annulés). */
export type LedgerMonthSummary = { month: string; count: number; collected: number; spent: number };
export type LedgerSummaryResponse = { months: LedgerMonthSummary[] };

// --- Annonces (tous les rôles) -----------------------------------------------------------------------

/** GET /api/announcements/summary?groupBy=month : les annonces non épinglées, par mois. */
export const announcementSummaryQuerySchema = z
  .object({ groupBy: z.literal('month'), category: z.enum(ANNOUNCEMENT_CATEGORIES).optional() })
  .strict();

export type AnnouncementMonthSummary = { month: string; count: number };
export type AnnouncementSummaryResponse = { months: AnnouncementMonthSummary[] };
