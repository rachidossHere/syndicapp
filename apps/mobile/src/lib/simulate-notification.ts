// Bouton de test (développement seulement, `__DEV__`) : programme une notification LOCALE qui porte
// les mêmes données qu'une vraie notification d'annonce, pour tester le toucher dans Expo Go (les
// push distants n'y sont pas disponibles). Elle arrive 5 secondes plus tard, ce qui laisse le temps de
// mettre l'appli en arrière-plan. Jamais le titre de l'annonce : le même texte générique que l'API.
import type { Language, LatestAnnouncementResponse } from '@syndic/shared';
import * as Notifications from 'expo-notifications';

import { apiFetch, inResidence } from './api';
import { simulatedAnnouncementNotification } from './announcement-notification';
import { pushDeps } from './push-device';

export const SIMULATION_DELAY_SECONDS = 5;

export type SimulationResult = 'scheduled' | 'no_announcement' | 'denied' | 'failed';

export async function simulateAnnouncementNotification(residenceId: string, language: Language): Promise<SimulationResult> {
  try {
    let permission = await pushDeps.getPermission();
    if (permission === 'undetermined') permission = await pushDeps.requestPermission();
    if (permission !== 'granted') return 'denied';

    // La notification pointe une vraie annonce de la résidence : la plus récente.
    const { announcement } = await apiFetch<LatestAnnouncementResponse>('/api/announcements/latest', inResidence(residenceId));
    if (announcement === null) return 'no_announcement';

    const content = simulatedAnnouncementNotification({
      residenceId,
      announcementId: announcement.id,
      language,
      urgent: announcement.category === 'urgent',
    });
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, data: content.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SIMULATION_DELAY_SECONDS },
    });
    return 'scheduled';
  } catch {
    return 'failed';
  }
}
