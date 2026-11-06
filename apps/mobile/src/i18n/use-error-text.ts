import { fr } from './fr';
import type { TranslationKey } from './translate';
import { useT } from './use-t';

/** Vrai si la valeur est une clé de traduction connue. */
export function isTranslationKey(value: unknown): value is TranslationKey {
  return typeof value === 'string' && value in fr;
}

/**
 * Traduit une clé d'erreur (formulaire ou API). Une valeur inconnue n'est jamais affichée telle
 * quelle : elle devient le message générique `auth.errors.invalidInput`.
 */
export function useErrorText() {
  const t = useT();
  return (key: string | undefined): string | undefined => {
    if (key === undefined || key === '') return undefined;
    return t(isTranslationKey(key) ? key : 'auth.errors.invalidInput');
  };
}
