import { useLocalSearchParams } from 'expo-router';

import { LotScreen } from '@/features/residences/lot-screen';

/** Fiche d'un appartement : modifier la référence, supprimer l'appartement. */
export default function LotRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LotScreen lotId={id} />;
}
