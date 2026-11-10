// Message de confirmation transmis à l'écran précédent (« Dépense enregistrée… » après le retour
// du formulaire). En mémoire uniquement ; on garde la clé de traduction, pas le texte, pour que
// la langue active s'applique à l'affichage.
import { useSyncExternalStore } from 'react';

import type { TranslationKey } from '@/i18n/translate';

let current: TranslationKey | undefined;
const listeners = new Set<() => void>();

export function setFlashMessage(key: TranslationKey | undefined): void {
  current = key;
  listeners.forEach((listener) => listener());
}

export function getFlashMessage(): TranslationKey | undefined {
  return current;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Clé du message à afficher (ou `undefined`), mise à jour dès qu'un écran en dépose un. */
export function useFlashMessage(): TranslationKey | undefined {
  return useSyncExternalStore(subscribe, getFlashMessage, getFlashMessage);
}
