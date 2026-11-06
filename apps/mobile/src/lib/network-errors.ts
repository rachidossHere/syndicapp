import { AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';

/** État du réseau tel que le renvoie expo-network (getNetworkStateAsync). */
export type NetworkStateLike = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
} | null | undefined;

/**
 * Clé d'une erreur réseau selon l'état du téléphone :
 * - pas de connexion (ou Internet injoignable) → `offline` ;
 * - connexion présente ou état inconnu → `network` (serveur injoignable : API arrêtée, mauvaise adresse).
 * Fonction pure (sans expo-network), utilisable dans les tests.
 */
export function networkErrorKey(state: NetworkStateLike): AuthErrorKey {
  if (state?.isConnected === false || state?.isInternetReachable === false) {
    return AUTH_ERROR_KEYS.offline;
  }
  return AUTH_ERROR_KEYS.network;
}

/** Erreur renvoyée par le client Better Auth ou par notre API (forme minimale). */
type ErrorLike = { status?: number; statusText?: string } | null | undefined;

/**
 * Vrai si l'erreur vient d'une requête qui n'a pas abouti (pas de réponse du serveur) :
 * statut absent ou 0, ou erreur « Fetch Error » produite par l'option catchAllError de better-fetch.
 */
export function isFetchFailure(error: ErrorLike): boolean {
  if (!error) return false;
  return error.status === undefined || error.status === 0 || error.statusText === 'Fetch Error';
}
