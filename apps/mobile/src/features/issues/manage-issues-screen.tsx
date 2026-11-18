// Écran 4 de docs/signalements.png : liste de traitement (syndic, adjoint, gardien : issues.manage).
// Bandeau « N signalement(s) urgent(s) à traiter », filtres Tous / Ouverts / En cours / Résolus avec
// leurs compteurs (GET /api/issues/counts), appartement et nom de l'auteur (envoyés par l'API à ces
// rôles seulement), badge de statut et « Urgent ». Bandeau et compteurs se rafraîchissent après
// chaque traitement (invalidation de issuesQueryKey) et au retour sur l'écran.
import { Banner, Button, Chip, EmptyState, Screen, Text, useTheme } from '@syndic/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Flag from 'lucide-react-native/icons/flag';
import Plus from 'lucide-react-native/icons/plus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

import { QueryFallback } from '@/features/charges/query-fallback';
import { useIssueCounts, useIssueList } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import {
  MANAGE_FILTERS,
  filterCount,
  issuesResidenceId,
  needsMoreUrgent,
  parseFilterParam,
  staffLineParts,
  urgentBannerKey,
  urgentOnly,
  type IssueFilter,
} from '@/lib/issues';

import { IssueListFooter, IssueRow } from './issue-row';
import { useIssueFormat } from './use-issue-format';

/** Bandeau rouge : le nombre d'urgents non résolus, dans un carré, puis le texte (singulier ou pluriel). */
export function UrgentBanner({ count }: { count: number }) {
  const { colors, radius, sizes, spacing } = useTheme();
  const t = useT();
  const label = t(urgentBannerKey(count));
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${count}, ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.dangerBg,
      }}>
      <View
        style={{
          minWidth: sizes.iconBox,
          height: sizes.iconBox,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: colors.dangerFg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="bodyStrong" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>
          {count}
        </Text>
      </View>
      <Text variant="bodyStrong" tone="danger" style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function ManageIssuesScreen() {
  const { colors, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useIssueFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = issuesResidenceId(active);
  // L'accueil ouvre cet écran déjà filtré (`/issues?filter=urgent`) ; le paramètre est consommé ensuite.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<IssueFilter>(() => parseFilterParam(params.filter, 'manage'));
  const list = useIssueList(residenceId, filter);
  const counts = useIssueCounts(residenceId);

  useEffect(() => {
    if (params.filter === undefined) return;
    setFilter(parseFilterParam(params.filter, 'manage'));
    router.setParams({ filter: undefined });
  }, [params.filter, router]);

  // « Urgents » : seuls les urgents non résolus, et la suite se charge tant que la liste n'est pas complète.
  const shown = useMemo(() => (filter === 'urgent' ? urgentOnly(list.items) : list.items), [filter, list.items]);
  const loadMoreUrgent =
    filter === 'urgent' &&
    list.loaded &&
    !list.isFetchingNextPage &&
    !list.isFetchNextPageError &&
    needsMoreUrgent(list.items, list.hasNextPage);
  useEffect(() => {
    if (loadMoreUrgent) void list.fetchNextPage();
  }, [loadMoreUrgent, list]);

  // Rafraîchissement au retour sur l'écran (après un traitement : liste, compteurs et bandeau).
  const refetchAll = useCallback(() => Promise.all([list.refetch(), counts.refetch()]), [list.refetch, counts.refetch]);
  useRefreshOnFocus(refetchAll);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const openIssue = (id: string) => router.push({ pathname: '/issue/[id]', params: { id } });
  const urgent = counts.data?.urgentUnresolved ?? 0;
  const roleLabel = active !== null ? t(`roles.${active.role}`) : undefined;

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {t('issues.manage.context', { residence: active.name, role: roleLabel ?? '' })}
          </Text>
        )}
        <Text variant="h2">{t('issues.title')}</Text>
      </View>
      {urgent > 0 && <UrgentBanner count={urgent} />}
      {/* Tous les rôles de cette vue peuvent aussi signaler (issues.write) : bouton discret, hors maquette. */}
      <Button variant="secondary" icon={Plus} label={t('issues.new')} onPress={() => router.push('/new-issue')} />
      {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
      {list.loaded && (list.isRefetchError || counts.isRefetchError) && <Banner message={t('issues.loadError')} />}
      {counts.data !== undefined && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: spacing.sm }}>
          {MANAGE_FILTERS.map((value) => (
            <Chip
              key={value}
              label={t(`issues.manage.filter.${value}`, { count: filterCount(value, counts.data!) })}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </ScrollView>
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
      domain="issues"
      title={t(filter === 'all' ? 'issues.manage.empty.title' : 'issues.manage.emptyFiltered.title')}
      description={t(filter === 'all' ? 'issues.manage.empty.body' : 'issues.manage.emptyFiltered.body')}
    />
  );

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        data={list.loaded ? shown : []}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => (
          <IssueRow
            issue={item}
            subtitle={staffLineParts(item, format.age(item.createdAt)).join(' · ')}
            onOpen={openIssue}
          />
        )}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: shown.length > 0 ? 0 : spacing.md }}
        ListEmptyComponent={empty}
        ListFooterComponent={<IssueListFooter list={list} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage && !list.isFetchNextPageError) void list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void refetchAll()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
