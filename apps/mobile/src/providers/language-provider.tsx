import type { Language } from '@syndic/shared';
import { ThemeProvider } from '@syndic/ui';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readStoredLanguage, reloadApp, storeLanguage, syncLayoutDirection } from '@/lib/language';

type LanguageContextValue = {
  language: Language;
  /** Mémorise la langue, change le sens d'écriture et recharge l'appli si besoin. */
  setLanguage: (language: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Langue active de l'appli, transmise au ThemeProvider de @syndic/ui. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  // Au démarrage, remet les réglages RTL en accord avec la langue mémorisée
  // (cas d'une appli fermée entre l'enregistrement et le rechargement).
  useEffect(() => {
    syncLayoutDirection(readStoredLanguage());
  }, []);

  const setLanguage = useCallback(
    async (next: Language) => {
      if (next === language) return;
      await storeLanguage(next);
      const needsReload = syncLayoutDirection(next);
      setLanguageState(next);
      if (needsReload) {
        await reloadApp();
      }
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext value={value}>
      <ThemeProvider language={language}>{children}</ThemeProvider>
    </LanguageContext>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = use(LanguageContext);
  if (!value) {
    throw new Error('useLanguage doit être utilisé sous un <LanguageProvider>.');
  }
  return value;
}
