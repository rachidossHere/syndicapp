import { CURRENCY } from './constants';

/** Espace insécable (U+00A0) : empêche un retour à la ligne au milieu d'un montant. */
const NBSP = ' ';
/** Signe moins typographique (U+2212). */
const MINUS = '−';

/**
 * Formate un montant en centimes pour l'affichage : `1842000` → `18 420 MAD`.
 *
 * - Séparateur de milliers et espace avant « MAD » : espaces insécables.
 * - Centimes affichés uniquement s'ils ne sont pas nuls : `45050` → `450,50 MAD`.
 * - Négatifs avec le signe « − » : `-240000` → `− 2 400 MAD`.
 *
 * Formatage manuel, sans `Intl.NumberFormat`, dont le support est incomplet sur Hermes.
 *
 * @throws {TypeError} si `centimes` n'est pas un entier sûr (`Number.isSafeInteger`).
 */
export function formatMad(centimes: number): string {
  if (!Number.isSafeInteger(centimes)) {
    throw new TypeError(
      `formatMad attend un nombre entier de centimes, reçu : ${String(centimes)}`,
    );
  }

  const absolute = Math.abs(centimes);
  const units = Math.floor(absolute / 100);
  const cents = absolute % 100;

  const groupedUnits = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = cents === 0 ? '' : `,${String(cents).padStart(2, '0')}`;
  const sign = centimes < 0 ? `${MINUS}${NBSP}` : '';

  return `${sign}${groupedUnits}${decimals}${NBSP}${CURRENCY}`;
}
