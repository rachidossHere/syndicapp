import { Stack } from 'expo-router/stack';

// Écrans accessibles sans session : accueil, inscription, connexion.
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
