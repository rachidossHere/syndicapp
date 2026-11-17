import { LOT_ERRORS, type LotErrorKey } from '@syndic/shared';

/** Statut HTTP de chaque refus de l'API des appartements. */
export const LOT_ERROR_STATUS = {
  [LOT_ERRORS.notFound]: 404,
  [LOT_ERRORS.referenceExists]: 409,
  [LOT_ERRORS.hasMember]: 409,
  [LOT_ERRORS.hasInvitation]: 409,
  [LOT_ERRORS.hasPayments]: 409,
  [LOT_ERRORS.hasCharges]: 409,
  [LOT_ERRORS.hasIssues]: 409,
  [LOT_ERRORS.inUse]: 409,
} as const satisfies Record<LotErrorKey, 404 | 409>;

/** Réponse de refus `{ error: <clé de traduction> }`, sans détail interne. */
export const lotRefusal = (key: LotErrorKey) =>
  Response.json({ error: key }, { status: LOT_ERROR_STATUS[key] });
