// Accueil du syndic, du trésorier et de l'adjoint (écran 1 de docs/design-v2.png) : salutation avec
// la date et l'avatar, en-tête de la résidence, solde de la caisse, « À traiter » et accès rapide.
// Chaque bloc dépend des permissions du rôle ; l'API refuse de toute façon ce que le rôle ne peut pas faire.
import { ResidenceHero } from '@syndic/ui';
import { useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useRoleLabel } from '@/features/residences/use-role-label';
import type { ResidenceSummary } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { quickActionsFor, showsCashCard } from '@/lib/home';

import { AttentionPills } from './attention-pills';
import { BalanceCard } from './balance-card';
import { HomeHeader, useTodayLabel } from './home-header';
import { QuickActions } from './quick-actions';

export function StaffHome({ name, residence }: { name: string; residence: ResidenceSummary }) {
  const { layout } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const today = useTodayLabel();
  const { role } = residence;

  return (
    <View style={{ gap: layout.sectionGap }}>
      <HomeHeader name={name} caption={today} />
      <ResidenceHero name={residence.name} roleLabel={t('home.heroRole', { role: roleLabel(role, { lower: true }) })} />
      {showsCashCard(role) && <BalanceCard role={role} residenceId={residence.id} />}
      <AttentionPills role={role} residenceId={residence.id} />
      <QuickActions actions={quickActionsFor(role)} title={t('home.quick.title')} />
    </View>
  );
}
