import { useRouter } from 'expo-router';

/** Retour : écran précédent s'il existe, sinon l'accueil (ex. après un lien entre les formulaires). */
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };
}
