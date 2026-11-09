// Accueil du copropriétaire : la carte « Mes charges » est le contenu principal
// (une carte par appartement), puis le lien vers l'historique et les reçus.
// Rendu uniquement pour un copropriétaire : un locataire ou un gardien ne déclenche aucune requête.
import { EmptyState, Icon, ListItem, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import Receipt from 'lucide-react-native/icons/receipt';
import Wallet from 'lucide-react-native/icons/wallet';
import { View } from 'react-native';

import { useMyDues } from '@/hooks/use-charges';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useT } from '@/i18n/use-t';

import { MyChargeCard } from './my-charge-card';
import { currentDuePerLot } from './my-charges';
import { QueryFallback } from './query-fallback';

export function MyChargesSummary({ residenceId }: { residenceId: string }) {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();
  const dues = useMyDues(residenceId);
  useRefreshOnFocus(dues.refetch);

  if (dues.data === undefined) return <QueryFallback query={dues} message={t('mine.loadError')} />;
  if (dues.data.length === 0) {
    return <EmptyState icon={Wallet} title={t('mine.emptyTitle')} description={t('mine.emptyBody')} />;
  }

  const current = currentDuePerLot(dues.data);
  return (
    <View style={{ gap: spacing.md }}>
      {current.map((due) => (
        <MyChargeCard key={due.id} due={due} showLot={current.length > 1} />
      ))}
      <ListItem
        title={t('mine.historyLink')}
        subtitle={t('mine.historyLinkBody')}
        leading={
          <View
            style={{
              width: sizes.iconBox,
              height: sizes.iconBox,
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon icon={Receipt} color={colors.primary} />
          </View>
        }
        onPress={() => router.push('/my-charges')}
      />
    </View>
  );
}
