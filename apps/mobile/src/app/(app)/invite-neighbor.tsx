import { useLocalSearchParams } from 'expo-router';

import { InviteScreen } from '@/features/residences/invite-screen';

/** Créer une invitation pour l'appartement `lotId` (venant de la liste des appartements). */
export default function InviteNeighborRoute() {
  const { lotId } = useLocalSearchParams<{ lotId?: string }>();
  return <InviteScreen lotId={lotId} />;
}
