// Écrans en accordéons (plan 02b, étape 5) : quelle section est ouverte. Sans React côté règles, et sans
// stockage : l'état ouvert ou fermé est gardé en mémoire pendant la session (on le retrouve en revenant
// sur l'écran) et effacé à la déconnexion, comme celui des bâtiments (`clearExpansion`, lib/api.ts).
import { useReducer } from 'react';

import { getExpansion, setExpansion } from './lot-groups';

/**
 * Section ouverte par défaut : la plus récente ou la plus urgente. `preferred` (l'année ou le mois en
 * cours) si la liste le contient, sinon la première section de la liste (déjà triée du plus récent au
 * plus urgent). `undefined` s'il n'y a aucune section.
 */
export function defaultOpenKey(keys: readonly string[], preferred?: string): string | undefined {
  if (preferred !== undefined && keys.includes(preferred)) return preferred;
  return keys[0];
}

/** Année en cours (fuseau Africa/Casablanca), « 2026 » : la section ouverte par défaut des écrans par année. */
export const currentYearKey = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric' }).format(now);

/** Mois en cours (fuseau Africa/Casablanca), « 2026-11 » : la section ouverte par défaut des écrans par mois. */
export function currentMonthKey(now: Date = new Date()): string {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(now).slice(0, 7);
}

/**
 * Ouvertures d'un écran, par résidence : `isOpen(clé, ouverteParDéfaut)` et `toggle(clé, ouverteParDéfaut)`.
 * `scope` (ex. `charges:<résidence>`) sépare les écrans et les résidences ; `undefined` tant qu'aucune
 * résidence n'est active.
 */
export function useSectionOpen(scope: string | undefined) {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const stored = scope === undefined ? {} : getExpansion(scope);

  const isOpen = (key: string, openByDefault: boolean): boolean => stored[key] ?? openByDefault;
  const toggle = (key: string, openByDefault: boolean): void => {
    if (scope === undefined) return;
    setExpansion(scope, { ...stored, [key]: !isOpen(key, openByDefault) });
    refresh();
  };
  return { isOpen, toggle };
}
