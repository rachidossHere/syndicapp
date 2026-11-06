import type { Language } from '@syndic/shared';

import { ar } from './ar';
import { fr, type TranslationKey } from './fr';

export type { TranslationKey } from './fr';

export const translations: Record<Language, Record<TranslationKey, string>> = { fr, ar };

export type TranslationParams = Record<string, string | number>;

/**
 * Texte traduit, avec remplacement des paramètres `{nom}`.
 * Fonction pure (sans React), utilisable dans les tests.
 */
export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  const text = translations[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
