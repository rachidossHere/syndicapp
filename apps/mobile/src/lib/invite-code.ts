import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  isInviteCodeFormat,
  normalizeInviteCode,
} from '@syndic/shared';

/**
 * Saisie d'un code : normalisée (majuscules, espaces et tirets retirés, collage d'un code entier
 * ou d'un lien accepté), limitée à l'alphabet des codes et à 6 caractères.
 */
export function sanitizeInviteInput(input: string): string {
  const withoutLink = input.includes('/') ? (input.split('/').filter(Boolean).pop() ?? '') : input;
  return [...normalizeInviteCode(withoutLink)]
    .filter((char) => INVITE_CODE_ALPHABET.includes(char))
    .slice(0, INVITE_CODE_LENGTH)
    .join('');
}

/** Le code est prêt pour l'aperçu : 6 caractères valides. */
export const isCompleteInviteCode = (code: string): boolean => isInviteCodeFormat(code);

/** Affichage en deux groupes : « K7Q4MX » → « K7Q 4MX ». */
export function formatInviteCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`.trim();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jours restants avant `expiresAt`, arrondis au supérieur (au moins 1 tant que l'invitation est valide). */
export function daysUntil(expiresAt: string, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
}

/** Références montrées dans l'aperçu de la génération rapide : les 5 premières, « … », les 2 dernières. */
export function previewReferences(references: readonly string[]): { shown: string[]; hasGap: boolean } {
  if (references.length <= 8) return { shown: [...references], hasGap: false };
  return { shown: [...references.slice(0, 5), ...references.slice(-2)], hasGap: true };
}
