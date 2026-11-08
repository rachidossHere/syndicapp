import { useLocalSearchParams } from 'expo-router';

import { ChargeCallScreen } from '@/features/charges/charge-call-screen';

/** Détail d'un appel de charges : un élément par appartement, reçus et annulations. */
export default function ChargeCallRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChargeCallScreen callId={id} />;
}
