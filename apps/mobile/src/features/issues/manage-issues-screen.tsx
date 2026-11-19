// Écran 5 de docs/accordeons.png : liste de traitement (syndic, adjoint, gardien : issues.manage), par statut.
// Le bandeau « N signalement(s) urgent(s) à traiter » reste au-dessus ; puis trois sections : Ouverts
// (ouverte), En cours, Résolus, chacune avec son nombre exact (GET /api/issues/counts). Les signalements
// d'une section ne sont chargés qu'à son ouverture, par pages (« Afficher plus »). Appartement et nom de
// l'auteur : envoyés par l'API à ces rôles seulement. Les puces de filtre n'existent plus sur cette vue :
// les sections font le même travail. Bandeau et compteurs se rafraîchissent après chaque traitement
// (invalidation de issuesQueryKey) et au retour sur l'écran.
import { Accordion, Badge, Banner, Button, EmptyState, Screen, Text, useTheme } from '@syndic/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Flag from 'lucide-react-native/icons/flag';
import Plus from 'lucide-react-native/icons/plus';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { LoadMore, SectionError, SectionLoading } from '@/components/section-parts';
import { QueryFallback } from '@/features/charges/query-fallback';
import { issuesQueryKey, useIssueCounts, useIssueList } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { issuesResidenceId, staffLineParts, urgentBannerKey, type IssueCounts } from '@/lib/issues';
import { defaultOpenKey, useSectionOpen } from '@/lib/sections';

import { IssueRow } from './issue-row';
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

/** Les trois sections, de la plus urgente à la moins urgente. */
const STATUSES = ['open', 'in_progress', 'resolved'] as const;
type SectionStatus = (typeof STATUSES)[number];

/** Signalements d'une section, chargés à l'ouverture : urgents d'abord (ordre de l'API), puis « Afficher plus ». */
function StatusIssues({ residenceId, status }: { residenceId: string; status: SectionStatus }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useIssueFormat();
  const list = useIssueList(residenceId, status);

  if (!list.loaded) {
    return list.error ? (
      <SectionError onRetry={() => void list.refetch()} retrying={list.isFetching} />
    ) : (
      <SectionLoading />
    );
  }
  if (list.items.length === 0) return <Text tone="muted">{t('sections.issues.empty')}</Text>;
  return (
    <View style={{ gap: spacing.md }}>
      {list.items.map((issue) => (
        <IssueRow
          key={issue.id}
          issue={issue}
          showStatus={false}
          subtitle={staffLineParts(issue, format.age(issue.createdAt)).join(' · ')}
          onOpen={(id) => router.push({ pathname: '/issue/[id]', params: { id } })}
        />
      ))}
      <LoadMore
        hasNextPage={list.hasNextPage}
        pending={list.isFetchingNextPage}
        failed={list.isFetchNextPageError}
        onPress={() => void list.fetchNextPage()}
      />
    </View>
  );
}

/** Résumé exact d'une section, à partir des compteurs de la résidence. */
function summaryOf(status: SectionStatus, count: number, t: ReturnType<typeof useT>): string {
  switch (status) {
    case 'open':
      return t('sections.issues.openSummary', { count });
    case 'in_progress':
      return t('sections.issues.inProgressSummary', { count });
    case 'resolved':
      return t(count === 1 ? 'sections.issues.resolvedSummaryOne' : 'sections.issues.resolvedSummary', { count });
  }
}

const BADGE_TONES = { open: 'danger', in_progress: 'warning', resolved: 'success' } as const;

export function ManageIssuesScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = issuesResidenceId(active);
  // L'accueil ouvre cet écran avec `/issues?filter=urgent` : les urgents sont les premiers de « Ouverts »,
  // déjà ouverte. Le paramètre est consommé pour ne pas rester dans l'adresse.
  const params = useLocalSearchParams<{ filter?: string }>();
  const counts = useIssueCounts(residenceId);
  const sections = useSectionOpen(residenceId === undefined ? undefined : `issues:${residenceId}`);

  useEffect(() => {
    if (params.filter !== undefined) router.setParams({ filter: undefined });
  }, [params.filter, router]);

  // Rafraîchissement au retour sur l'écran (après un traitement : compteurs, bandeau et listes ouvertes).
  const refreshAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: issuesQueryKey(residenceId ?? 'none') }),
    [queryClient, residenceId],
  );
  useRefreshOnFocus(refreshAll);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const urgent = counts.data?.urgentUnresolved ?? 0;
  const roleLabel = active !== null ? t(`roles.${active.role}`) : undefined;
  const countOf = (data: IssueCounts, status: SectionStatus): number => data[status];
  // Ouverte par défaut : « Ouverts », ou la première section qui contient quelque chose.
  const openKey =
    counts.data === undefined ? undefined : defaultOpenKey(STATUSES.filter((status) => countOf(counts.data!, status) > 0));
  const total = counts.data === undefined ? 0 : STATUSES.reduce((sum, status) => sum + countOf(counts.data!, status), 0);

  let body;
  if (counts.data === undefined) {
    body = (
      <QueryFallback
        query={{ error: counts.error, isFetching: counts.isFetching, refetch: counts.refetch }}
        message={t('issues.loadError')}
      />
    );
  } else if (total === 0) {
    body = (
      <EmptyState domain="issues" title={t('issues.manage.empty.title')} description={t('issues.manage.empty.body')} />
    );
  } else {
    const data = counts.data;
    body = (
      <>
        {STATUSES.map((status) => {
          const count = countOf(data, status);
          return (
            <Accordion
              key={status}
              icon={Flag}
              title={t(`sections.issues.${status}`)}
              subtitle={summaryOf(status, count, t)}
              trailing={<Badge tone={BADGE_TONES[status]} label={String(count)} />}
              trailingLabel={String(count)}
              disabled={count === 0}
              expanded={count > 0 && sections.isOpen(status, status === openKey)}
              onToggle={() => sections.toggle(status, status === openKey)}>
              {residenceId !== undefined && <StatusIssues residenceId={residenceId} status={status} />}
            </Accordion>
          );
        })}
      </>
    );
  }

  return (
    <Screen scroll onRefresh={() => void refreshAll()} refreshing={counts.isRefetching}>
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
      {/* Un échec d'actualisation garde les sections affichées, avec un message non bloquant. */}
      {counts.isRefetchError && <Banner message={t('issues.loadError')} />}
      {body}
    </Screen>
  );
}
