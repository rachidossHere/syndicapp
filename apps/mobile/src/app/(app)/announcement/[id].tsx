import { useLocalSearchParams } from 'expo-router';

import { AnnouncementDetailScreen } from '@/features/announcements/announcement-detail-screen';

/** Détail d'une annonce. */
export default function AnnouncementDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AnnouncementDetailScreen announcementId={id} />;
}
