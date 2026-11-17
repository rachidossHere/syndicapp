import { z } from 'zod';

import { LOT_TYPES } from './roles';

/** Nombre maximal de lots créés par un appel de génération rapide. */
export const MAX_BULK_LOTS = 500;

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

export const createResidenceSchema = z.object({
  name: requiredText(120),
  city: requiredText(80),
  address: optionalText(200),
});
export type CreateResidenceInput = z.infer<typeof createResidenceSchema>;

/** Référence d'un lot (« B12 »). */
export const lotReferenceSchema = requiredText(20);

export const createLotSchema = z.object({
  reference: lotReferenceSchema,
  building: optionalText(20),
  floor: z.number().int().min(-5).max(200).optional(),
  type: z.enum(LOT_TYPES).default('apartment'),
});
export type CreateLotInput = z.infer<typeof createLotSchema>;

/** Modification d'un appartement : sa référence seulement (mêmes règles de format qu'à la création). */
export const updateLotSchema = z.object({ reference: lotReferenceSchema }).strict();
export type UpdateLotInput = z.infer<typeof updateLotSchema>;

/** Ce qui empêche de supprimer un appartement (dans l'ordre où l'API les teste). */
export const LOT_DELETE_BLOCKERS = ['member', 'invitation', 'payment', 'charge', 'issue'] as const;
export type LotDeleteBlocker = (typeof LOT_DELETE_BLOCKERS)[number];

/** Refus de l'API des appartements : clés de traduction (`lots.errors.*`). */
export const LOT_ERRORS = {
  notFound: 'lots.errors.notFound',
  referenceExists: 'lots.errors.referenceExists',
  hasMember: 'lots.errors.hasMember',
  hasInvitation: 'lots.errors.hasInvitation',
  hasPayments: 'lots.errors.hasPayments',
  hasCharges: 'lots.errors.hasCharges',
  hasIssues: 'lots.errors.hasIssues',
  inUse: 'lots.errors.inUse',
} as const;
export type LotErrorKey = (typeof LOT_ERRORS)[keyof typeof LOT_ERRORS];

/** Clé de refus de suppression pour chaque obstacle. */
export const LOT_BLOCKER_ERRORS = {
  member: LOT_ERRORS.hasMember,
  invitation: LOT_ERRORS.hasInvitation,
  payment: LOT_ERRORS.hasPayments,
  charge: LOT_ERRORS.hasCharges,
  issue: LOT_ERRORS.hasIssues,
} as const satisfies Record<LotDeleteBlocker, LotErrorKey>;

/** Réponse de la création en lot : références créées et références déjà présentes (ignorées). */
export type BulkLotsResult = { created: number; skipped: number };

/** Bâtiment : lettre ou nom court (« A », « B2 »), mis en majuscules. */
const buildingSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,4}$/)
  .transform((value) => value.toUpperCase());

/**
 * Génération rapide : « bâtiments A et B, étages 1 à 4, 3 appartements par étage ».
 * Référence = bâtiment + étage + numéro (A11 = bâtiment A, étage 1, appartement 1).
 */
export const bulkLotsSchema = z
  .object({
    buildings: z.array(buildingSchema).min(1).max(50),
    floorFrom: z.number().int().min(0).max(100),
    floorTo: z.number().int().min(0).max(100),
    perFloor: z.number().int().min(1).max(100),
  })
  .refine((value) => value.floorFrom <= value.floorTo)
  .refine((value) => new Set(value.buildings).size === value.buildings.length)
  .refine(
    (value) =>
      value.buildings.length * (value.floorTo - value.floorFrom + 1) * value.perFloor <=
      MAX_BULK_LOTS,
  )
  // Deux lots ne peuvent pas avoir la même référence (ex. A1+10 et A11+0 : A110).
  .refine((value) => {
    const references = generateBulkLots(value).map((lot) => lot.reference);
    return new Set(references).size === references.length;
  });
export type BulkLotsInput = z.infer<typeof bulkLotsSchema>;

/** Forme des paramètres de génération (évite une référence circulaire avec le schéma). */
export type BulkLotsShape = {
  buildings: string[];
  floorFrom: number;
  floorTo: number;
  perFloor: number;
};

export type GeneratedLot = { reference: string; building: string; floor: number };

/** Lots générés, dans l'ordre bâtiment, étage, numéro. */
export function generateBulkLots(input: BulkLotsShape): GeneratedLot[] {
  const lots: GeneratedLot[] = [];
  for (const building of input.buildings) {
    for (let floor = input.floorFrom; floor <= input.floorTo; floor++) {
      for (let number = 1; number <= input.perFloor; number++) {
        lots.push({ reference: `${building}${floor}${number}`, building, floor });
      }
    }
  }
  return lots;
}

/** Statut d'un lot : membre actif, invitation valide en attente, ou libre. */
export const LOT_STATUSES = ['member', 'pending', 'free'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];
