import { Redirect } from 'expo-router';

import { useSession } from '@/hooks/use-session';

/**
 * Racine « / » (et lien syndicapp:// sans chemin) : jamais protégée, elle redirige selon la session.
 * Sans elle, « / » n'existait que dans le groupe protégé (app) : sans session, Expo Router retire
 * ce groupe de l'arbre des routes et affichait « Unmatched Route ».
 * Le layout racine n'affiche les routes qu'une fois la session connue.
 */
export default function Index() {
  const { user } = useSession();
  return <Redirect href={user ? '/home' : '/welcome'} />;
}
