// Accueil du copropriétaire, du locataire et du gardien (écran 2 de docs/design-v2.png) : salutation,
// résidence et appartement, carte « Charges de <période> » (copropriétaire seulement), « Dernière
// annonce » illustrée, et accès à ce que le rôle peut faire. Locataire et gardien n'ont jamais de carte
// de charges ; le gardien a ses signalements à traiter.
import { useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { LatestAnnouncementCard } from '@/features/announcements/latest-announcement-card';
import { lotReferences } from '@/features/charges/my-charges';
import { useRoleLabel } from '@/features/residences/use-role-label';
import { useMyDues } from '@/hooks/use-charges';
import type { ResidenceSummary } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { residentActionsFor, showsChargesCard } from '@/lib/home';

import { AttentionPills } from './attention-pills';
import { HomeHeader } from './home-header';
import { MonthChargesCard } from './month-charges-card';
import { QuickActions } from './quick-actions';

export function ResidentHome({ name, residence }: { name: string; residence: ResidenceSummary }) {
  const { layout } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const { role } = residence;
  const isOwner = showsChargesCard(role);
  // Mes appartements : connus par mes dus (même requête que la carte, donc partagée). Sans dû, le rôle.
  const dues = useMyDues(isOwner ? residence.id : undefined);
  const caption =
    isOwner && dues.data !== undefined && dues.data.length > 0
      ? t('mine.context', { name: residence.name, lots: lotReferences(dues.data) })
      : t('home.residenceLine', { name: residence.name, role: roleLabel(role, { lower: true }) });

  return (
    <View style={{ gap: layout.sectionGap }}>
      <HomeHeader name={name} caption={caption} />
      {isOwner && <MonthChargesCard residenceId={residence.id} />}
      {/* Gardien : ses signalements à traiter (ouverts, urgents). */}
      <AttentionPills role={role} residenceId={residence.id} />
      <LatestAnnouncementCard residenceId={residence.id} />
      <QuickActions actions={residentActionsFor(role)} />
    </View>
  );
}
