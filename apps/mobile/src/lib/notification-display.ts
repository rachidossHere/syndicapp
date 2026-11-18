// Affichage d'une notification reçue quand l'appli est ouverte : sans ce réglage, iOS ne montre rien
// au premier plan et l'utilisateur ne pourrait pas la toucher. Aucun badge, aucun texte ajouté.
import * as Notifications from 'expo-notifications';

let configured = false;

export function configureNotificationDisplay(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
