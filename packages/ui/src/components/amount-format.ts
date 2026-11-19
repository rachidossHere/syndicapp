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

/**
 * Même texte que `formatAmount`, pour un montant ENTIER de centimes, utilisable dans un worklet (fil
 * d'interface) : le compteur du solde (`AnimatedAmount`) l'appelle à chaque image. Il doit rester le
 * miroir de `formatAmount` et de `formatMad` (mêmes séparateurs, même signe, mêmes isolations).
 */
export function formatAmountWorklet(centimes: number, direction: AmountDirection): string {
  'worklet';
  const absolute = Math.abs(centimes);
  const units = Math.floor(absolute / 100);
  const cents = absolute % 100;
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = cents === 0 ? '' : `,${String(cents).padStart(2, '0')}`;
  const body = `${grouped}${decimals}${NBSP}MAD`;
  let text: string;
  if (direction === 'in') text = `+${NBSP}${body}`;
  else if (direction === 'out') text = `${MINUS}${NBSP}${body}`;
  else text = centimes < 0 ? `${MINUS}${NBSP}${body}` : body;
  return `${LTR_ISOLATE}${text}${POP_ISOLATE}`;
}
