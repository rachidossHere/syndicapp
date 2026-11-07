import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// Comme la langue : une préférence locale non sensible, lue de façon synchrone au démarrage
// (AsyncStorage est proscrit par AGENTS.md).
const STORAGE_KEY = 'syndic.activeResidence';

function readStored(): string | null {
  try {
    return SecureStore.getItem(STORAGE_KEY) || null;
  } catch {
    // Stockage indisponible (web) : aucune résidence mémorisée.
    return null;
  }
}

let activeId: string | null = readStored();
const listeners = new Set<() => void>();

/** Identifiant de la résidence active, ou `null` (lu par `apiFetch` pour `X-Residence-Id`). */
export function getActiveResidenceId(): string | null {
  return activeId;
}

/** Change la résidence active et la mémorise sur le téléphone (`null` : aucune). */
export function setActiveResidenceId(id: string | null): void {
  if (id === activeId) return;
  activeId = id;
  try {
    if (id === null) SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
    else SecureStore.setItemAsync(STORAGE_KEY, id).catch(() => undefined);
  } catch {
    // Mémorisation impossible : la résidence reste active pour cette session.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Identifiant mémorisé de la résidence active, réactif. */
export function useActiveResidenceId(): string | null {
  return useSyncExternalStore(subscribe, getActiveResidenceId, getActiveResidenceId);
}
