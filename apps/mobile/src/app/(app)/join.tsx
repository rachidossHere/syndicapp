import { useLocalSearchParams } from 'expo-router';

import { JoinScreen } from '@/features/residences/join-screen';

/** Rejoindre avec un code, saisi ou reçu par lien profond (`?code=`). */
export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinScreen initialCode={code} />;
}
