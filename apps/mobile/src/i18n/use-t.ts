import { useCallback } from 'react';

import { useLanguage } from '@/providers/language-provider';

import { translate, type TranslationKey, type TranslationParams } from './translate';

/** Fonction de traduction branchée sur la langue active : `t('signIn.title')`. */
export function useT() {
  const { language } = useLanguage();
  return useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language],
  );
}
