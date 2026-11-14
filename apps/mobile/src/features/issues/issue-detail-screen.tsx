// Détail d'un signalement : traitement (écran 5) pour les rôles avec issues.manage, suivi de
// l'habitant (écran 3) pour les autres.
import { useActiveResidence } from '@/hooks/use-residences';
import { issuesViewFor } from '@/lib/issues';

import { ManageIssueScreen } from './manage-issue-screen';
import { ResidentIssueDetailScreen } from './resident-issue-detail-screen';

export function IssueDetailScreen({ issueId }: { issueId: string | undefined }) {
  const { active } = useActiveResidence();
  return issuesViewFor(active?.role) === 'manage' ? (
    <ManageIssueScreen issueId={issueId} />
  ) : (
    <ResidentIssueDetailScreen issueId={issueId} />
  );
}
