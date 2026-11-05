import type { Language } from '@syndic/shared';

import type { FontWeightToken } from '../tokens/typography';

/** Graisses chargées pour chaque police (plan 02). */
export type FontWeight = '400' | '500' | '600' | '700' | '800';

/**
 * Noms des familles de police, identiques aux clés exportées par les paquets
 * `@expo-google-fonts/*` : l'appli les charge sous ces noms avec `useFonts`.
 */
export const fontFamilies = {
  fr: {
    '400': 'PlusJakartaSans_400Regular',
    '500': 'PlusJakartaSans_500Medium',
    '600': 'PlusJakartaSans_600SemiBold',
    '700': 'PlusJakartaSans_700Bold',
    '800': 'PlusJakartaSans_800ExtraBold',
  },
  ar: {
    '400': 'IBMPlexSansArabic_400Regular',
    '500': 'IBMPlexSansArabic_500Medium',
    '600': 'IBMPlexSansArabic_600SemiBold',
    '700': 'IBMPlexSansArabic_700Bold',
  },
} as const satisfies { fr: Record<FontWeight, string>; ar: Partial<Record<FontWeight, string>> };

/** Nom de famille de n'importe quelle police chargée par l'appli. */
export type FontFamilyName =
  | (typeof fontFamilies.fr)[keyof typeof fontFamilies.fr]
  | (typeof fontFamilies.ar)[keyof typeof fontFamilies.ar];

/**
 * Renvoie la famille de police pour une graisse et une langue.
 * IBM Plex Sans Arabic n'existe pas en 800 : la graisse 800 retombe sur 700 en arabe.
 *
 * Chaque graisse est un fichier de police distinct : on passe donc par `fontFamily`
 * et jamais par `fontWeight`, sinon iOS simule la graisse ou revient à la police système.
 */
export function fontFamily(weight: FontWeight | FontWeightToken, language: Language): FontFamilyName {
  if (language === 'ar') {
    return fontFamilies.ar[weight === '800' ? '700' : weight];
  }
  return fontFamilies.fr[weight];
}
