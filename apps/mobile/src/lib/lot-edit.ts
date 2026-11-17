// Fiche d'un appartement : validation de la nouvelle référence et état du bouton « Supprimer ».
import { LOT_BLOCKER_ERRORS, LOT_ERRORS, updateLotSchema, type LotDeleteBlocker } from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

export type ReferenceDraft = {
  /** Valeur à envoyer (sans espaces autour). */
  value: string;
  /** Mêmes règles de format que la création (schéma partagé avec l'API). */
  valid: boolean;
  /** Différente de la référence actuelle : sinon il n'y a rien à enregistrer. */
  changed: boolean;
};

export function referenceDraft(input: string, current: string): ReferenceDraft {
  const value = input.trim();
  return { value, valid: updateLotSchema.safeParse({ reference: value }).success, changed: value !== current };
}

/** Le bouton « Modifier la référence » n'est actif que si la saisie est valide et nouvelle. */
export const canSaveReference = (draft: ReferenceDraft): boolean => draft.valid && draft.changed;

/**
 * « Supprimer l'appartement » : actif seulement si rien n'est rattaché à l'appartement. Sinon le
 * bouton est désactivé et la raison (clé de traduction `lots.errors.has*`) est affichée.
 */
export function deleteState(blocker: LotDeleteBlocker | null | undefined): {
  disabled: boolean;
  reasonKey: TranslationKey | undefined;
} {
  if (blocker === null || blocker === undefined) return { disabled: false, reasonKey: undefined };
  return { disabled: true, reasonKey: LOT_BLOCKER_ERRORS[blocker] };
}

/** Clés d'erreur de l'API des appartements que l'appli sait afficher (`lots.errors.*`). */
export const LOT_API_ERROR_KEYS: readonly string[] = Object.values(LOT_ERRORS);
