import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect } from 'react';

import { consumePendingInviteCode } from '@/lib/pending-invite';

// Écrans protégés : accessibles uniquement avec une session (voir Stack.Protected dans app/_layout.tsx).
export const unstable_settings = { anchor: 'home' };

export default function AppLayout() {
  const router = useRouter();

  // Lien d'invitation ouvert avant la connexion : une fois connecté, on arrive sur l'écran du code.
  useEffect(() => {
    const code = consumePendingInviteCode();
    if (code) router.push({ pathname: '/join', params: { code } });
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
