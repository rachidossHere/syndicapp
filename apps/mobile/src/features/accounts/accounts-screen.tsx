// Écrans 1 et 6 de docs/depenses.png : « Comptes » (solde de la caisse, encaissé et dépensé de la
// période en cours, journal des mouvements chargé par pages). Visible par les rôles qui ont
// `accounts.read` ; locataire et gardien sont renvoyés à l'accueil sans aucune requête.
// Le journal ne montre jamais le nom d'un copropriétaire : « Charge reçue · A21 ».
import {
  Amount,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  ListItem,
  Screen,
  Text,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import Wallet from 'lucide-react-native/icons/wallet';
import { FlatList, RefreshControl, View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import { useCash } from '@/hooks/use-cash';
import { useActiveResidence } from '@/hooks/use-residences';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useT } from '@/i18n/use-t';
import { accountsResidenceId, canSetOpeningBalance, ledgerView, type LedgerEntry } from '@/lib/cash';

import { useAccountsFormat } from './use-accounts-format';

function LedgerRow({ entry, onOpen }: { entry: LedgerEntry; onOpen: (id: string) => void }) {
  const t = useT();
  const { colors, radius, sizes, spacing } = useTheme();
  const text = useAccountsFormat();
  const view = ledgerView(entry);
  const incoming = view.direction === 'in';
  const title = text.entryTitle(entry);
  const line = text.entryLine(entry);

  return (
    <ListItem
      title={title}
      subtitle={line}
      accessibilityLabel={[
        t(incoming ? 'accounts.ledger.entryIn' : 'accounts.ledger.entryOut'),
        title,
        line,
        ...(view.cancelled ? [t('accounts.badge.cancelled')] : []),
        ...(view.noInvoice ? [t('accounts.badge.noInvoice')] : []),
      ].join(', ')}
      leading={
        // Le signe (+ ou −) double la couleur : un sens n'est jamais signalé par la couleur seule.
        <View
          style={{
            width: sizes.iconBox,
            height: sizes.iconBox,
            borderRadius: radius.sm,
            borderCurve: 'continuous',
            backgroundColor: incoming ? colors.successBg : colors.dangerBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={incoming ? Plus : Minus} color={incoming ? colors.successFg : colors.moneyOut} />
        </View>
      }
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <Amount
            centimes={entry.amount}
            direction={view.direction}
            style={view.cancelled ? { textDecorationLine: 'line-through' } : undefined}
          />
          {view.cancelled && <Badge tone="info" label={t('accounts.badge.cancelled')} />}
          {view.noInvoice && !view.cancelled && <Badge tone="warning" label={t('accounts.badge.noInvoice')} />}
        </View>
      }
      onPress={view.opensDetail ? () => onOpen(entry.id) : undefined}
    />
  );
}

export function AccountsScreen() {
  const { colors, radius, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = accountsResidenceId(active);
  const cash = useCash(residenceId);

  // Rafraîchissement au retour sur l'écran (après une annulation, un solde de départ…).
  useRefreshOnFocus(cash.refetch);


  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const first = cash.data?.pages[0];
  const items = cash.data?.pages.flatMap((page) => page.ledger.items) ?? [];
  const isManager = active !== null && canSetOpeningBalance(active.role);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openExpense = (id: string) => router.push({ pathname: '/expense/[id]', params: { id } });
  const openOpening = () => router.push('/opening-balance');
  const period = first === undefined ? '' : format.shortPeriod(first.period.label);

  const header = (
    <View style={{ gap: spacing.lg }}>
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {active.name}
          </Text>
        )}
        <Text variant="h2">{t('accounts.title')}</Text>
      </View>

      {first !== undefined && (
        <>
          {/* Un échec d'actualisation garde les comptes affichés, avec un message non bloquant. */}
          {cash.isRefetchError && <Banner message={t('accounts.loadError')} />}

          {/* Syndic : invitation discrète tant qu'aucun solde de départ n'a été saisi. */}
          {isManager && first.openingBalanceDate === null && (
            <ListItem
              title={t('accounts.openingInvite.title')}
              subtitle={t('accounts.openingInvite.body')}
              onPress={openOpening}
            />
          )}

          <View
            accessible
            accessibilityLabel={t('accounts.balance.label')}
            style={{
              gap: spacing.sm,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: colors.primary,
            }}>
            <Text variant="small" tone="inverse">
              {t('accounts.balance.label')}
            </Text>
            <Amount centimes={first.balance} variant="display" tone="inverse" />
            <Text variant="small" tone="inverse">
              {t('accounts.balance.note')}
            </Text>
          </View>

          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="caption" tone="muted">
                {t('accounts.period.collected', { period })}
              </Text>
              <Amount centimes={first.period.collected} variant="h3" />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="caption" tone="muted">
                {t('accounts.period.spent', { period })}
              </Text>
              <Amount centimes={first.period.spent} variant="h3" style={{ color: colors.moneyOut }} />
            </View>
          </Card>

          {isManager && <Button variant="secondary" label={t('accounts.openingLink')} onPress={openOpening} />}

          <Text variant="h3">{t('accounts.ledger.title')}</Text>
        </>
      )}
    </View>
  );

  const empty =
    cash.data === undefined ? (
      <QueryFallback query={cash} message={t('accounts.loadError')} />
    ) : (
      <EmptyState icon={Wallet} title={t('accounts.ledger.emptyTitle')} description={t('accounts.ledger.emptyBody')} />
    );

  const footer = cash.isFetchNextPageError ? (
    <View style={{ gap: spacing.sm }}>
      <Banner message={t('accounts.loadMoreError')} />
      <Button
        variant="secondary"
        label={t('common.retry')}
        loading={cash.isFetchingNextPage}
        onPress={() => void cash.fetchNextPage()}
      />
    </View>
  ) : cash.isFetchingNextPage ? (
    <Text tone="muted" style={{ textAlign: 'center' }}>
      {t('common.loading')}
    </Text>
  ) : undefined;

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        data={items}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        renderItem={({ item }) => <LedgerRow entry={item} onOpen={openExpense} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: items.length > 0 ? 0 : spacing.md }}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (cash.hasNextPage && !cash.isFetchingNextPage && !cash.isFetchNextPageError) {
            void cash.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={cash.isRefetching && !cash.isFetchingNextPage}
            onRefresh={() => void cash.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
