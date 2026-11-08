import { useLocalSearchParams } from 'expo-router';

import { ReceiptScreen } from '@/features/charges/receipt-screen';

/** Détail d'un reçu : « Ouvrir le PDF » et « Partager ». */
export default function ReceiptRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReceiptScreen receiptId={id} />;
}
