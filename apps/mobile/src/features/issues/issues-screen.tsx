// Entrée « Signalements » de l'accueil : la vue dépend du rôle dans la résidence active. Les rôles
// avec issues.manage (syndic, adjoint, gardien) ont la vue de traitement (écran 4), les autres la
// vue de l'habitant (écrans 1 et 6).
import { useActiveResidence } from '@/hooks/use-residences';
import { issuesViewFor } from '@/lib/issues';

import { ManageIssuesScreen } from './manage-issues-screen';
import { ResidentIssuesScreen } from './resident-issues-screen';

export function IssuesScreen() {
  const { active } = useActiveResidence();
  return issuesViewFor(active?.role) === 'manage' ? <ManageIssuesScreen /> : <ResidentIssuesScreen />;
}
