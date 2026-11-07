import { CHARGE_ERRORS, type ChargeErrorKey } from '@syndic/shared';

/** Statut HTTP de chaque refus de l'API des charges. */
export const CHARGE_ERROR_STATUS = {
  [CHARGE_ERRORS.notFound]: 404,
  [CHARGE_ERRORS.periodExists]: 409,
  [CHARGE_ERRORS.periodMismatch]: 400,
  [CHARGE_ERRORS.noLots]: 409,
  [CHARGE_ERRORS.amountExceedsRemaining]: 409,
  [CHARGE_ERRORS.paymentDateInvalid]: 400,
  [CHARGE_ERRORS.alreadyCancelled]: 409,
  [CHARGE_ERRORS.cancelReasonRequired]: 400,
  [CHARGE_ERRORS.periodLocked]: 409,
} as const satisfies Record<ChargeErrorKey, 400 | 404 | 409>;

/** Réponse de refus `{ error: <clé de traduction> }`. */
export const chargeRefusal = (key: ChargeErrorKey) =>
  Response.json({ error: key }, { status: CHARGE_ERROR_STATUS[key] });

/** Refus levé dans une transaction : l'annule, puis devient une réponse `chargeRefusal`. */
export class ChargeRefusal extends Error {
  constructor(readonly key: ChargeErrorKey) {
    super(key);
  }
}

/** Exécute `run` et convertit un `ChargeRefusal` en réponse de refus. */
export async function withRefusals(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ChargeRefusal) return chargeRefusal(error.key);
    throw error;
  }
}

/** Violation d'unicité Postgres (Drizzle l'enveloppe dans `cause`). */
export const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === '23505';
};
