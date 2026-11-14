import { useLocalSearchParams } from 'expo-router';

import { IssueDetailScreen } from '@/features/issues/issue-detail-screen';

/** Détail d'un signalement avec son suivi. */
export default function IssueDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IssueDetailScreen issueId={id} />;
}
