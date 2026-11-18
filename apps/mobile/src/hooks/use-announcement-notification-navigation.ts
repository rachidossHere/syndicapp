// Toucher d'une notification d'annonce (plan 08, étape 3) : ouvre le détail de l'annonce.
// `useLastNotificationResponse` couvre les trois cas : appli ouverte, appli en arrière-plan et
// lancement de l'appli depuis la notification (dernière réponse de notification).
//
// - La notification ne porte que { type, residenceId, itemId } : jamais de titre ni de nom.
// - Résidence de la notification = résidence active : le détail s'ouvre directement.
// - Autre résidence dont l'utilisateur est membre : on bascule d'abord sur elle, puis le détail s'ouvre.
// - Résidence inconnue de l'utilisateur (ou liste des résidences illisible) : l'accueil, sans erreur.
// Chaque réponse n'est traitée qu'une fois (identifiant de la notification).
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useResidences } from '@/hooks/use-residences';
import { getActiveResidenceId, setActiveResidenceId } from '@/lib/active-residence';
import { parseAnnouncementNotification, planAnnouncementNavigation } from '@/lib/announcement-notification';

const handled = new Set<string>();

export function useAnnouncementNotificationNavigation(): void {
  const router = useRouter();
  const residences = useResidences();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    const target = parseAnnouncementNotification(response.notification.request.content.data);
    if (target === null) {
      handled.add(id);
      return;
    }
    // Il faut connaître les résidences de l'utilisateur pour décider : on attend leur chargement.
    if (residences.data === undefined && !residences.isError) return;
    handled.add(id);

    const plan = planAnnouncementNavigation(
      target,
      getActiveResidenceId(),
      (residences.data ?? []).map((residence) => residence.id),
    );
    switch (plan.kind) {
      case 'home':
        router.navigate('/home');
        break;
      case 'open':
        router.push({ pathname: '/announcement/[id]', params: { id: plan.announcementId } });
        break;
      case 'switch_and_open':
        setActiveResidenceId(plan.residenceId);
        router.push({ pathname: '/announcement/[id]', params: { id: plan.announcementId } });
        break;
    }
  }, [response, residences.data, residences.isError, router]);
}
