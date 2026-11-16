// Branchement réel de push-registration.ts : expo-notifications, expo-constants, expo-device, notre API
// et un indicateur local « écran déjà montré ». Rien n'est écrit dans AsyncStorage.
//
// Expo Go : les push distants n'y sont pas fournis (SDK 53+) et l'appli n'a pas de projectId EAS
// (validation reportée au plan 12). `getToken` lève alors une erreur de code `no_project_id` ou
// celle d'Expo : push-registration.ts ne journalise que ce code et retentera à la prochaine ouverture.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { apiFetch } from './api';
import type { IntroStore, PermissionState, PushDeps } from './push-registration';

const INTRO_SEEN_KEY = 'syndic.pushIntroSeen';

function toState(status: Notifications.PermissionStatus): PermissionState {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

/** Identifiant de projet EAS, s'il est configuré (il ne l'est pas avant le plan 12). */
function easProjectId(): string | undefined {
  const fromExpoConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromExpoConfig ?? Constants.easConfig?.projectId ?? undefined;
}

export const pushDeps: PushDeps = {
  getPermission: async () => toState((await Notifications.getPermissionsAsync()).status),
  requestPermission: async () => toState((await Notifications.requestPermissionsAsync()).status),
  getToken: async () => {
    const projectId = easProjectId();
    if (projectId === undefined) throw Object.assign(new Error('no_project_id'), { code: 'no_project_id' });
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  },
  sendToken: async (token) => {
    await apiFetch('/api/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, device: Device.deviceName ?? Device.modelName ?? undefined }),
    });
  },
  deleteToken: async (token) => {
    try {
      await apiFetch('/api/push-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
    } catch (error) {
      // 404 : le jeton n'est plus (ou n'est plus à ce compte) en base — rien à supprimer.
      if ((error as { status?: number }).status === 404) return;
      throw error;
    }
  },
  // Un code d'erreur seulement : jamais de jeton.
  logCode: (code) => console.warn(`[push] ${code}`),
};

/** Indicateur local : l'écran « Restez informé » a déjà été montré sur ce téléphone. */
export const introStore: IntroStore = {
  isSeen: () => {
    try {
      return SecureStore.getItem(INTRO_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  },
  markSeen: () => {
    try {
      SecureStore.setItemAsync(INTRO_SEEN_KEY, '1').catch(() => undefined);
    } catch {
      // Stockage indisponible : l'écran pourra se réafficher, sans conséquence.
    }
  },
};
