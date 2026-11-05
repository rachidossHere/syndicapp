import { formatMad } from '@syndic/shared';

export type AmountDirection = 'in' | 'out' | 'neutral';

const NBSP = ' ';
const MINUS = '−';
/**
 * Isolation de gauche à droite (U+2066 … U+2069) : en arabe, le montant reste lu et affiché
 * « + 450 MAD » au lieu d'être réordonné par l'algorithme bidirectionnel.
 */
const LTR_ISOLATE = '⁦';
const POP_ISOLATE = '⁩';

/**
 * Texte d'un montant : `in` → « + 450 MAD », `out` → « − 2 400 MAD », `neutral` → « 18 420 MAD ».
 * Le sens est donné par `direction` ; le montant en centimes est pris en valeur absolue
 * pour `in` et `out`. Identique en français et en arabe (chiffres latins, suffixe MAD).
 */
export function formatAmount(centimes: number, direction: AmountDirection = 'neutral'): string {
  let text: string;
  if (direction === 'in') {
    text = `+${NBSP}${formatMad(Math.abs(centimes))}`;
  } else if (direction === 'out') {
    text = `${MINUS}${NBSP}${formatMad(Math.abs(centimes))}`;
  } else {
    text = formatMad(centimes);
  }
  return `${LTR_ISOLATE}${text}${POP_ISOLATE}`;
}
