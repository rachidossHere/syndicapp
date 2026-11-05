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
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: 'syndicapp',
      storagePrefix: 'syndicapp',
      storage: SecureStore,
    }),
  ],
});
