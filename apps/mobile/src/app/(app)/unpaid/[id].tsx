import { useLocalSearchParams } from 'expo-router';

import { UnpaidScreen } from '@/features/charges/unpaid-screen';

/** Impayés d'un appel de charges : relance d'un lot ou de tous (syndic). */
export default function UnpaidRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UnpaidScreen callId={id} />;
}
