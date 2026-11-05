/** Langues de l'application : français et arabe (écrit de droite à gauche). */
export const LANGUAGES = ['fr', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'fr';

/** Vrai pour une langue qui s'écrit de droite à gauche. */
export function isRtlLanguage(language: Language): boolean {
  return language === 'ar';
}

/** Vérifie qu'une valeur lue (stockage, en-tête…) est une langue prise en charge. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
