import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect } from 'react';

import { useNotificationNavigation } from '@/hooks/use-notification-navigation';
import { configureNotificationDisplay } from '@/lib/notification-display';
import { consumePendingInviteCode } from '@/lib/pending-invite';
import { introStore, pushDeps } from '@/lib/push-device';
import { runPushStartup } from '@/lib/push-registration';

// Écrans protégés : accessibles uniquement avec une session (voir Stack.Protected dans app/_layout.tsx).
export const unstable_settings = { anchor: 'home' };

export default function AppLayout() {
  const router = useRouter();
  // Notification touchée (appli ouverte, en arrière-plan ou fermée) : ouvre l'écran lié.
  configureNotificationDisplay();
  useNotificationNavigation();

  // Lien d'invitation ouvert avant la connexion : une fois connecté, on arrive sur l'écran du code.
  useEffect(() => {
    const code = consumePendingInviteCode();
    if (code) router.push({ pathname: '/join', params: { code } });
    // Notifications (plan 08) : écran « Restez informé » une seule fois après la connexion, sinon
    // réenregistrement du jeton si l'autorisation est déjà accordée (retente un échec précédent).
    // Avec une invitation à traiter, l'écran attend la prochaine ouverture.
    void runPushStartup(pushDeps, introStore)
      .then((action) => {
        if (action === 'show_intro' && !code) router.push('/push-intro');
      })
      .catch(() => undefined);
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
