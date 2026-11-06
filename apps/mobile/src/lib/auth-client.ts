import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_URL } from './config';

/**
 * Client Better Auth de l'appli (documentation « Expo Integration », version 1.7.17).
 *
 * La session (cookie et cache de session) est stockée **dans SecureStore**, jamais dans
 * AsyncStorage, sous les clés `syndicapp_cookie` et `syndicapp_session_data`
 * (découpées en `<clé>.0`, `<clé>.1`… si la valeur est longue).
 * Le plugin envoie l'origine de l'appli (`expo-origin`), acceptée par `trustedOrigins` côté API.
 */
/**
 * Option de better-fetch transmise telle quelle par Better Auth (config.catchAllError) :
 * une requête sans réponse (pas de réseau, API arrêtée, mauvaise adresse) devient une erreur
 * renvoyée ({ status: 500, statusText: "Fetch Error" }) au lieu d'une promesse rejetée et non gérée.
 * Elle n'est pas déclarée dans le type ClientFetchOption de Better Auth 1.7.17 : d'où la conversion
 * explicite (le comportement est vérifié par l'appli, voir lib/network-errors.ts).
 */
type AuthFetchOptions = NonNullable<NonNullable<Parameters<typeof createAuthClient>[0]>['fetchOptions']>;
const fetchOptions = { catchAllError: true } as unknown as AuthFetchOptions;

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions,
  plugins: [
    expoClient({
      scheme: 'syndicapp',
      storagePrefix: 'syndicapp',
      storage: SecureStore,
    }),
  ],
});
