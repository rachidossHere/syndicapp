import { AUTH_ERROR_KEYS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { toAuthResult } from './auth-errors';
import { isFetchFailure, networkErrorKey } from './network-errors';

describe('networkErrorKey : état du réseau → clé de traduction', () => {
  it('pas de connexion → offline', () => {
    expect(networkErrorKey({ isConnected: false, isInternetReachable: false })).toBe(AUTH_ERROR_KEYS.offline);
  });

  it('connecté mais Internet injoignable → offline', () => {
    expect(networkErrorKey({ isConnected: true, isInternetReachable: false })).toBe(AUTH_ERROR_KEYS.offline);
  });

  it('connecté (API arrêtée ou mauvaise adresse) → network', () => {
    expect(networkErrorKey({ isConnected: true, isInternetReachable: true })).toBe(AUTH_ERROR_KEYS.network);
  });

  it('état inconnu → network (le serveur est mis en cause par défaut)', () => {
    expect(networkErrorKey({ isConnected: true, isInternetReachable: null })).toBe(AUTH_ERROR_KEYS.network);
    expect(networkErrorKey(null)).toBe(AUTH_ERROR_KEYS.network);
    expect(networkErrorKey(undefined)).toBe(AUTH_ERROR_KEYS.network);
  });
});

describe('isFetchFailure : requête sans réponse du serveur', () => {
  it('reconnaît l’erreur de catchAllError (faux statut 500 « Fetch Error »)', () => {
    expect(isFetchFailure({ status: 500, statusText: 'Fetch Error' })).toBe(true);
  });

  it('reconnaît un statut absent ou nul', () => {
    expect(isFetchFailure({})).toBe(true);
    expect(isFetchFailure({ status: 0 })).toBe(true);
  });

  it('ne confond pas une vraie réponse du serveur avec un échec réseau', () => {
    expect(isFetchFailure({ status: 500, statusText: 'Internal Server Error' })).toBe(false);
    expect(isFetchFailure({ status: 401 })).toBe(false);
    expect(isFetchFailure(null)).toBe(false);
  });
});

describe('toAuthResult : erreurs réseau', () => {
  it('« Fetch Error » à l’inscription et à la connexion → network, jamais unknown', () => {
    for (const action of ['signUp', 'signIn'] as const) {
      expect(toAuthResult({ status: 500, statusText: 'Fetch Error' }, action)).toEqual({
        ok: false,
        formError: AUTH_ERROR_KEYS.network,
      });
    }
  });

  it('une vraie erreur 500 du serveur reste unknown', () => {
    expect(toAuthResult({ status: 500, statusText: 'Internal Server Error' }, 'signIn')).toEqual({
      ok: false,
      formError: AUTH_ERROR_KEYS.unknown,
    });
  });
});
