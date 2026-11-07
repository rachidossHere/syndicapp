import { useLocalSearchParams } from 'expo-router';

import { InviteScreen } from '@/features/residences/invite-screen';

/** Invitation en attente : code, lien, partage et annulation. */
export default function InvitationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InviteScreen invitationId={id} />;
}
