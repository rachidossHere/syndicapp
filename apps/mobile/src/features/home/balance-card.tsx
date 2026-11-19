// Carte « Solde de la caisse » de l'accueil de gestion (écran 1 de docs/design-v2.png) : solde,
// encaissé et dépensé de la période en cours, et petite courbe. Données de GET /api/cash (les mêmes
// que l'écran « Comptes », donc partagées par le cache) : aucune nouvelle API. La courbe se déduit des
// derniers mouvements du journal ; sans au moins 3 points, elle n'est pas affichée.
import { Amount, Card, PressableScale, Skeleton, Sparkline, Text, formatAmount, useTheme } from '@syndic/ui';
import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import { useCash } from '@/hooks/use-cash';
import { useT } from '@/i18n/use-t';
import { balanceSeries } from '@/lib/home';
import { accountsHref } from '@/lib/tabs';
import type { Role } from '@syndic/shared';

export function BalanceCard({ role, residenceId }: { role: Role; residenceId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const cash = useCash(residenceId);
  const first = cash.data?.pages[0];

  if (first === undefined) {
    if (cash.error) return <QueryFallback query={cash} message={t('home.cash.loadError')} />;
    return (
      <Card>
        <View accessible accessibilityLabel={t('common.loading')} style={{ gap: spacing.sm }}>
          <Skeleton width="40%" />
          <Skeleton width="65%" height={spacing.xxxl} />
          <Skeleton width="80%" />
        </View>
      </Card>
    );
  }

  const { balance, period, ledger } = first;
  const series = balanceSeries(balance, ledger.items);
  const periodLabel = format.period(period.label);
  const href = accountsHref(role);

  return (
    <PressableScale
      onPress={() => (href === '/accounts-tab' ? router.navigate(href as Href) : router.push(href as Href))}
      accessibilityLabel={t('home.cash.a11y', {
        balance: formatAmount(balance, 'neutral'),
        collected: formatAmount(period.collected, 'neutral'),
        spent: formatAmount(period.spent, 'neutral'),
        period: periodLabel,
      })}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="small" tone="muted">
              {t('home.cash.title')}
            </Text>
            <Amount centimes={balance} variant="display" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Amount centimes={period.collected} direction="in" variant="small" />
                <Text variant="small" tone="muted">
                  {t('home.cash.collected')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Amount centimes={period.spent} direction="out" variant="small" />
                <Text variant="small" tone="muted">
                  {t('home.cash.spent')}
                </Text>
              </View>
            </View>
            <Text variant="caption" tone="muted">
              {t('home.cash.period', { period: periodLabel })}
            </Text>
          </View>
          <Sparkline values={series} />
        </View>
      </Card>
    </PressableScale>
  );
}
