// Bouton de test (développement seulement, `__DEV__`) : programme une notification LOCALE qui porte
// les mêmes données qu'une vraie notification du type choisi, pour tester le toucher dans Expo Go
// (les push distants n'y sont pas disponibles). Elle arrive 5 secondes plus tard, ce qui laisse le
// temps de mettre l'appli en arrière-plan. Jamais de titre, de nom ni de montant : le même texte
// générique que l'API.
import type { Language, NotificationType } from '@syndic/shared';
import * as Notifications from 'expo-notifications';

import { apiFetch, inResidence } from './api';
import { simulatedNotification, simulationItemId } from './notification-target';
import { pushDeps } from './push-device';

export const SIMULATION_DELAY_SECONDS = 5;

export type SimulationResult = 'scheduled' | 'no_announcement' | 'no_issue' | 'denied' | 'failed';

export async function simulateNotification(
  residenceId: string,
  language: Language,
  type: NotificationType,
): Promise<SimulationResult> {
  try {
    let permission = await pushDeps.getPermission();
    if (permission === 'undetermined') permission = await pushDeps.requestPermission();
    if (permission !== 'granted') return 'denied';

    // La notification pointe un vrai élément de la résidence.
    const itemId = await simulationItemId(type, <T>(path: string) =>
      apiFetch<T>(path, inResidence(residenceId)),
    );
    if (itemId === undefined) {
      return type === 'announcement' || type === 'announcement_urgent'
        ? 'no_announcement'
        : 'no_issue';
    }

    const content = simulatedNotification({ type, residenceId, itemId, language });
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, data: content.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SIMULATION_DELAY_SECONDS,
      },
    });
    return 'scheduled';
  } catch {
    return 'failed';
  }
}
