// Écrans 1 et 6 de docs/signalements.png : liste des signalements de la résidence (habitant ; les
// rôles avec issues.manage ont la vue de traitement, manage-issues-screen.tsx).
// Bouton « Signaler un problème », filtres « En cours » et « Résolus » avec leurs compteurs, urgents
// non résolus en tête (badge « Urgent »), chargement par pages, « tirer pour actualiser » et
// rafraîchissement au retour sur l'écran. Tous les rôles peuvent signaler ; aucun nom d'auteur n'est
// affiché ici (l'API ne l'envoie pas à un habitant).
import {
  AnimatedList,
  Banner,
  Button,
  Chip,
  EmptyState,
  EntranceRow,
  Screen,
  Text,
  Toast,
  useListEntrance,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Flag from 'lucide-react-native/icons/flag';
import Plus from 'lucide-react-native/icons/plus';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { QueryFallback } from '@/features/charges/query-fallback';
import { useIssueCounts, useIssueList } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
import { RESIDENT_FILTERS, filterCount, issuesResidenceId, type IssueFilter } from '@/lib/issues';

import { IssueListFooter, IssueRow } from './issue-row';
import { useIssueFormat } from './use-issue-format';

/** Durée d'affichage de la confirmation « Signalement envoyé ». */
const TOAST_MS = 4000;

export function ResidentIssuesScreen() {
  const { colors, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = issuesResidenceId(active);
  const [filter, setFilter] = useState<IssueFilter>('active');
  const list = useIssueList(residenceId, filter);
  const counts = useIssueCounts(residenceId);
  // Les premiers signalements apparaissent en cascade au premier affichage seulement.
  const entrance = useListEntrance(list.loaded);
  const flash = useFlashMessage();
  const format = useIssueFormat();

  // Rafraîchissement au retour sur l'écran (après un signalement, un commentaire, une réouverture).
  const refetchAll = useCallback(() => Promise.all([list.refetch(), counts.refetch()]), [list.refetch, counts.refetch]);
  useRefreshOnFocus(refetchAll);

  useEffect(() => {
    if (flash === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const openIssue = (id: string) => router.push({ pathname: '/issue/[id]', params: { id } });

  const header = (
    <View style={{ gap: spacing.lg }}>
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
      {counts.data !== undefined && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {RESIDENT_FILTERS.map((value) => (
            <Chip
              key={value}
              label={t(`issues.filter.${value}`, { count: filterCount(value, counts.data!) })}
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
      domain="issues"
      title={t(filter === 'active' ? 'issues.empty.title' : 'issues.emptyResolved.title')}
      description={t(filter === 'active' ? 'issues.empty.body' : 'issues.emptyResolved.body')}
    />
  );

  const footer = <IssueListFooter list={list} note={list.loaded ? t('issues.visibility') : undefined} />;

  return (
    <Screen>
      <AnimatedList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        data={list.loaded ? list.items : []}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item, index }) => (
          <EntranceRow entrance={entrance} index={index}>
            <IssueRow issue={item} subtitle={format.listLine(item)} onOpen={openIssue} />
          </EntranceRow>
        )}
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
