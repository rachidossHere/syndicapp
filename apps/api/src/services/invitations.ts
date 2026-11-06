import { randomInt } from 'node:crypto';

import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH, INVITE_VALIDITY_DAYS } from '@syndic/shared';

/** Code tiré au hasard avec `crypto.randomInt` (sans biais), dans l'alphabet sans caractères ambigus. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** Date d'expiration d'une invitation créée à `from`. */
export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}
