// Écran 4 de docs/accordeons.png : « Comptes » (solde de la caisse au-dessus, puis les mouvements par
// mois). Le mois en cours est ouvert ; les autres sont fermés avec leur résumé exact « +encaissé · −dépensé ».
// Les mouvements d'un mois ne sont chargés qu'à l'ouverture de sa section, par pages (« Afficher plus »).
// Visible par les rôles qui ont `accounts.read` ; locataire et gardien sont renvoyés à l'accueil sans
// aucune requête. Le journal ne montre jamais le nom d'un copropriétaire : « Charge reçue · A21 ».
import { formatMad } from '@syndic/shared';
import {
  Accordion,
  Amount,
  Badge,
  Banner,
  Button,
  EmptyState,
  Icon,
  ListItem,
  Screen,
  Text,
  ZelligePattern,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Calendar from 'lucide-react-native/icons/calendar';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { View } from 'react-native';

import { LoadMore, SectionError, SectionLoading } from '@/components/section-parts';
import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import { useCashBalance, useCashOfMonth, useLedgerMonths, useRefreshExpenses } from '@/hooks/use-cash';
import { useActiveResidence } from '@/hooks/use-residences';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useT } from '@/i18n/use-t';
import { accountsResidenceId, canSetOpeningBalance, ledgerView, type LedgerEntry } from '@/lib/cash';
import { currentMonthKey, defaultOpenKey, useSectionOpen } from '@/lib/sections';

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

/** Mouvements d'un mois, chargés à l'ouverture de sa section : les premiers, puis « Afficher plus ». */
function MonthMovements({
  residenceId,
  month,
  onOpen,
}: {
  residenceId: string;
  month: string;
  onOpen: (id: string) => void;
}) {
  const { spacing } = useTheme();
  const cash = useCashOfMonth(residenceId, month);

  if (cash.data === undefined) {
    return cash.error ? (
      <SectionError onRetry={() => void cash.refetch()} retrying={cash.isFetching} />
    ) : (
      <SectionLoading />
    );
  }
  const items = cash.data.pages.flatMap((page) => page.ledger.items);
  return (
    <View style={{ gap: spacing.md }}>
      {items.map((entry) => (
        <LedgerRow key={`${entry.kind}-${entry.id}`} entry={entry} onOpen={onOpen} />
      ))}
      <LoadMore
        hasNextPage={cash.hasNextPage}
        pending={cash.isFetchingNextPage}
        failed={cash.isFetchNextPageError}
        onPress={() => void cash.fetchNextPage()}
      />
    </View>
  );
}

/**
 * Comptes. `asTab` : onglet « Comptes » de l'adjoint (pas de bouton retour, la langue est dans le Profil) ;
 * sinon écran ouvert au-dessus des onglets (accès rapide du syndic, du trésorier et du copropriétaire).
 */
export function AccountsScreen({ asTab = false }: { asTab?: boolean }) {
  const { colors, radius, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = accountsResidenceId(active);
  const balance = useCashBalance(residenceId);
  const months = useLedgerMonths(residenceId);
  const sections = useSectionOpen(residenceId === undefined ? undefined : `accounts:${residenceId}`);

  // Rafraîchissement au retour sur l'écran (après une annulation, un solde de départ…) : solde, mois et mouvements.
  const refreshAll = useRefreshExpenses(residenceId);
  useRefreshOnFocus(refreshAll);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const isManager = active !== null && canSetOpeningBalance(active.role);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openExpense = (id: string) => router.push({ pathname: '/expense/[id]', params: { id } });
  const openOpening = () => router.push('/opening-balance');
  const monthKeys = months.data?.map((month) => month.month) ?? [];
  const openKey = defaultOpenKey(monthKeys, currentMonthKey());

  let body;
  if (months.data === undefined) {
    body = <QueryFallback query={months} message={t('accounts.loadError')} />;
  } else if (months.data.length === 0) {
    body = (
      <EmptyState
        domain="expenses"
        title={t('accounts.ledger.emptyTitle')}
        description={t('accounts.ledger.emptyBody')}
      />
    );
  } else {
    body = (
      <>
        <Text variant="h3">{t('accounts.ledger.title')}</Text>
        {months.data.map((month) => (
          <Accordion
            key={month.month}
            icon={Calendar}
            title={format.period(month.month)}
            subtitle={t('sections.accounts.summary', {
              collected: formatMad(month.collected),
              spent: formatMad(month.spent),
            })}
            expanded={sections.isOpen(month.month, month.month === openKey)}
            onToggle={() => sections.toggle(month.month, month.month === openKey)}>
            {residenceId !== undefined && (
              <MonthMovements residenceId={residenceId} month={month.month} onOpen={openExpense} />
            )}
          </Accordion>
        ))}
      </>
    );
  }

  return (
    <Screen scroll onRefresh={() => void refreshAll()} refreshing={months.isRefetching}>
      {!asTab && <AuthHeader onBack={goBack} />}
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {active.name}
          </Text>
        )}
        <Text variant="h2">{t('accounts.title')}</Text>
      </View>

      {/* Un échec d'actualisation garde les comptes affichés, avec un message non bloquant. */}
      {(balance.isRefetchError || months.isRefetchError) && <Banner message={t('accounts.loadError')} />}

      {balance.data !== undefined && (
        <>
          {/* Syndic : invitation discrète tant qu'aucun solde de départ n'a été saisi. */}
          {isManager && balance.data.openingBalanceDate === null && (
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
              overflow: 'hidden',
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: colors.tealDeep,
            }}>
            <ZelligePattern color={colors.textInverse} />
            <Text variant="small" tone="inverse">
              {t('accounts.balance.label')}
            </Text>
            <Amount centimes={balance.data.balance} variant="display" tone="inverse" />
            <Text variant="small" tone="inverse">
              {t('accounts.balance.note')}
            </Text>
          </View>

          {isManager && <Button variant="secondary" label={t('accounts.openingLink')} onPress={openOpening} />}
        </>
      )}
      {body}
    </Screen>
  );
}
