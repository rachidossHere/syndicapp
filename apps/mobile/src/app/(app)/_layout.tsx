import { Stack } from 'expo-router/stack';

// Écrans protégés : accessibles uniquement avec une session (voir Stack.Protected dans app/_layout.tsx).
export const unstable_settings = { anchor: 'home' };

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
