import { AUTH_ERROR_KEYS, type AuthErrorKey } from '@syndic/shared';
import * as Network from 'expo-network';

import { networkErrorKey } from './network-errors';

/**
 * Après un échec réseau, distingue « pas de connexion » de « serveur injoignable »
 * avec expo-network. En cas de doute, c'est le serveur qui est mis en cause.
 */
export async function currentNetworkErrorKey(): Promise<AuthErrorKey> {
  try {
    return networkErrorKey(await Network.getNetworkStateAsync());
  } catch {
    return AUTH_ERROR_KEYS.network;
  }
}
