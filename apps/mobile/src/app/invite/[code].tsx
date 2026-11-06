import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/hooks/use-session';
import { setPendingInviteCode } from '@/lib/pending-invite';

/**
 * Lien profond syndicapp://invite/<code>. Route publique (hors des groupes protégés) :
 * - connecté : ouvre l'écran « J'ai un code d'invitation » avec le code rempli ;
 * - non connecté : garde le code en mémoire et envoie vers l'accueil ; après la connexion ou
 *   l'inscription, le groupe (app) reprend le code (voir (app)/_layout.tsx).
 */
export default function InviteLinkRoute() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { user } = useSession();
  const value = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    if (user === null && value) setPendingInviteCode(value);
  }, [user, value]);

  if (user !== null) return <Redirect href={{ pathname: '/join', params: { code: value } }} />;
  return <Redirect href="/welcome" />;
}
