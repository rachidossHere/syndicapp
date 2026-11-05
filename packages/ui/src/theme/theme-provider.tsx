import { isRtlLanguage, type Language } from '@syndic/shared';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { uiMessage, type UiMessageKey } from '../i18n/messages';
import { borderWidth, colors, layout, opacity, radius, sizes, spacing, typography } from '../tokens';
import { fontFamily, type FontFamilyName, type FontWeight } from './font';

export type Theme = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  layout: typeof layout;
  radius: typeof radius;
  sizes: typeof sizes;
  borderWidth: typeof borderWidth;
  opacity: typeof opacity;
  /** Langue active. */
  language: Language;
  /** Vrai si la langue active s'écrit de droite à gauche. */
  isRtl: boolean;
  /** Famille de police pour une graisse, dans la langue active. */
  fontFamily: (weight: FontWeight) => FontFamilyName;
  /** Texte propre au design system (statuts, états), dans la langue active. */
  t: (key: UiMessageKey) => string;
};

const ThemeContext = createContext<Theme | null>(null);

export type ThemeProviderProps = {
  /** Langue active, choisie et mémorisée par l'appli. */
  language: Language;
  children: ReactNode;
};

/** Expose les jetons et la langue active à toute l'appli. */
export function ThemeProvider({ language, children }: ThemeProviderProps) {
  const theme = useMemo<Theme>(
    () => ({
      colors,
      typography,
      spacing,
      layout,
      radius,
      sizes,
      borderWidth,
      opacity,
      language,
      isRtl: isRtlLanguage(language),
      fontFamily: (weight) => fontFamily(weight, language),
      t: (key) => uiMessage(key, language),
    }),
    [language],
  );

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** Jetons et langue active. À utiliser sous un `ThemeProvider`. */
export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (!theme) {
    throw new Error('useTheme doit être utilisé sous un <ThemeProvider>.');
  }
  return theme;
}
