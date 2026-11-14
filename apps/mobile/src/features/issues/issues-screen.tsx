// Écrans 1 et 6 de docs/signalements.png : liste des signalements de la résidence (habitant).
// Bouton « Signaler un problème », filtres « En cours » et « Résolus » avec leurs compteurs, urgents
// non résolus en tête (badge « Urgent »), chargement par pages, « tirer pour actualiser » et
// rafraîchissement au retour sur l'écran. Tous les rôles peuvent signaler ; aucun nom d'auteur n'est
// affiché ici (l'API ne l'envoie pas à un habitant).
import { Badge, Banner, Button, Chip, EmptyState, Icon, ListItem, Screen, StatusBadge, Text, Toast, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Flag from 'lucide-react-native/icons/flag';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useIssueList } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
import { ISSUE_FILTERS, filterCount, issuesResidenceId, type IssueFilter, type IssueItem } from '@/lib/issues';

import { LOCATION_ICONS } from './location-icon';
import { useIssueFormat } from './use-issue-format';

/** Durée d'affichage de la confirmation « Signalement envoyé ». */
const TOAST_MS = 4000;

function IssueRow({ issue, onOpen }: { issue: IssueItem; onOpen: (id: string) => void }) {
  const t = useT();
  const { colors, radius, sizes, spacing } = useTheme();
  const format = useIssueFormat();
  const line = format.listLine(issue);

  return (
    <ListItem
      title={issue.title}
      subtitle={line}
      accessibilityLabel={[
        t('issues.rowLabel', { title: issue.title, status: t(`issues.status.${issue.status}`) }),
        ...(issue.urgent ? [t('issues.urgent')] : []),
        line,
      ].join(', ')}
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
          <Icon icon={LOCATION_ICONS[issue.location]} color={colors.primary} />
        </View>
      }
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <StatusBadge status={issue.status} />
          {issue.urgent && issue.status !== 'resolved' && <Badge tone="danger" label={t('issues.urgent')} />}
        </View>
      }
      onPress={() => onOpen(issue.id)}
    />
  );
}

export function IssuesScreen() {
  const { colors, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = issuesResidenceId(active);
  const [filter, setFilter] = useState<IssueFilter>('active');
  const list = useIssueList(residenceId, filter);
  const flash = useFlashMessage();

  // Rafraîchissement au retour sur l'écran (après un signalement, un commentaire, une réouverture).
  useRefreshOnFocus(list.refetch);

  useEffect(() => {
    if (flash === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openIssue = (id: string) => router.push({ pathname: '/issue/[id]', params: { id } });

  const header = (
    <View style={{ gap: spacing.lg }}>
      <AuthHeader onBack={goBack} />
      {flash !== undefined && <Toast message={t(flash)} />}
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {active.name}
          </Text>
        )}
        <Text variant="h2">{t('issues.title')}</Text>
      </View>
      <Button icon={Plus} label={t('issues.new')} onPress={() => router.push('/new-issue')} />
      {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
      {list.loaded && list.isRefetchError && <Banner message={t('issues.loadError')} />}
      {list.counts !== undefined && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ISSUE_FILTERS.map((value) => (
            <Chip
              key={value}
              label={t(`issues.filter.${value}`, { count: filterCount(value, list.counts!) })}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </View>
      )}
    </View>
  );

  // Jamais d'état vide pendant le premier chargement : « Chargement… » ou l'erreur avec « Réessayer ».
  const empty = !list.loaded ? (
    <QueryFallback
      query={{ error: list.error, isFetching: list.isFetching, refetch: list.refetch }}
      message={t('issues.loadError')}
    />
  ) : (
    <EmptyState
      icon={Flag}
      title={t(filter === 'active' ? 'issues.empty.title' : 'issues.emptyResolved.title')}
      description={t(filter === 'active' ? 'issues.empty.body' : 'issues.emptyResolved.body')}
    />
  );

  const footer = (
    <View style={{ gap: spacing.md }}>
      {list.isFetchNextPageError ? (
        <View style={{ gap: spacing.sm }}>
          <Banner message={t('issues.loadMoreError')} />
          <Button
            variant="secondary"
            label={t('common.retry')}
            loading={list.isFetchingNextPage}
            onPress={() => list.fetchNextPage()}
          />
        </View>
      ) : list.isFetchingNextPage ? (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {t('common.loading')}
        </Text>
      ) : null}
      {list.loaded && (
        <Text variant="small" tone="muted">
          {t('issues.visibility')}
        </Text>
      )}
    </View>
  );

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        data={list.loaded ? list.items : []}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => <IssueRow issue={item} onOpen={openIssue} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: list.items.length > 0 ? 0 : spacing.md }}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage && !list.isFetchNextPageError) list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void list.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
