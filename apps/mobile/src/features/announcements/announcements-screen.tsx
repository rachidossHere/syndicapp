// Écran 6 de docs/accordeons.png : « Annonces », pour tous les rôles. Les annonces épinglées restent au-dessus,
// hors accordéon ; les autres sont regroupées par mois : le mois en cours est ouvert, les autres fermés avec
// « N annonces ». Les annonces d'un mois ne sont chargées qu'à l'ouverture de sa section, par pages
// (« Afficher plus »). Les puces de catégorie restent au-dessus et s'appliquent aux sections (les compteurs
// des mois sont ceux de la catégorie choisie) ; les annonces épinglées restent toujours visibles.
// Seuls announcements.write (syndic, adjoint) voient le bouton « Nouvelle annonce » : l'API refuse de
// toute façon les autres rôles.
import {
  Accordion,
  Banner,
  Button,
  Chip,
  EmptyState,
  Screen,
  Text,
  Toast,
  useTheme,
} from '@syndic/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Plus from 'lucide-react-native/icons/plus';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { LoadMore, SectionError, SectionLoading } from '@/components/section-parts';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useChargeFormat } from '@/features/charges/use-charge-format';
import {
  announcementsQueryKey,
  useAnnouncementMonths,
  useAnnouncementsOfMonth,
  usePinnedAnnouncements,
} from '@/hooks/use-announcements';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import {
  ANNOUNCEMENT_FILTERS,
  announcementFilterLabelKey,
  announcementsResidenceId,
  canPublishAnnouncement,
  type AnnouncementCategory,
  type AnnouncementFilter,
} from '@/lib/announcements';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
import { currentMonthKey, defaultOpenKey, useSectionOpen } from '@/lib/sections';

import { AnnouncementRow } from './announcement-row';

/** Durée d'affichage de la confirmation « Annonce publiée ». */
const TOAST_MS = 4000;

/** Annonces non épinglées d'un mois, chargées à l'ouverture de sa section. */
function MonthAnnouncements({
  residenceId,
  month,
  category,
  onOpen,
}: {
  residenceId: string;
  month: string;
  category: AnnouncementCategory | undefined;
  onOpen: (id: string) => void;
}) {
  const { spacing } = useTheme();
  const list = useAnnouncementsOfMonth(residenceId, month, category);

  if (!list.loaded) {
    return list.error ? (
      <SectionError onRetry={() => void list.refetch()} retrying={list.isFetching} />
    ) : (
      <SectionLoading />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {list.items.map((item) => (
        <AnnouncementRow key={item.id} item={item} onOpen={onOpen} />
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

export function AnnouncementsScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = announcementsResidenceId(active);
  const canPublish = canPublishAnnouncement(active?.role);
  const [filter, setFilter] = useState<AnnouncementFilter>('all');
  const category = filter === 'all' ? undefined : filter;
  const pinned = usePinnedAnnouncements(residenceId);
  const months = useAnnouncementMonths(residenceId, category);
  const sections = useSectionOpen(residenceId === undefined ? undefined : `announcements:${residenceId}`);
  const flash = useFlashMessage();

  // Rafraîchissement au retour sur l'écran (après une publication, un épinglage) : épinglées, mois et sections ouvertes.
  const refreshAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: announcementsQueryKey(residenceId ?? 'none') }),
    [queryClient, residenceId],
  );
  useRefreshOnFocus(refreshAll);

  useEffect(() => {
    if (flash === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const openAnnouncement = (id: string) => router.push({ pathname: '/announcement/[id]', params: { id } });
  const monthKeys = months.data?.map((month) => month.month) ?? [];
  const openKey = defaultOpenKey(monthKeys, currentMonthKey());
  const loaded = pinned.loaded && months.data !== undefined;
  const hasPinned = pinned.items.length > 0;

  let body;
  if (!loaded) {
    // Jamais d'état vide pendant le premier chargement : « Chargement… » ou l'erreur avec « Réessayer ».
    const failing = !pinned.loaded && pinned.error ? pinned : months;
    body = (
      <QueryFallback
        query={{ error: failing.error, isFetching: failing.isFetching, refetch: failing.refetch }}
        message={t('announcements.loadError')}
      />
    );
  } else {
    body = (
      <>
        {/* Épinglées : au-dessus, hors accordéon. */}
        {hasPinned && (
          <View style={{ gap: spacing.md }}>
            {pinned.items.map((item) => (
              <AnnouncementRow key={item.id} item={item} onOpen={openAnnouncement} />
            ))}
            <LoadMore
              hasNextPage={pinned.hasNextPage}
              pending={pinned.isFetchingNextPage}
              failed={pinned.isFetchNextPageError}
              onPress={() => void pinned.fetchNextPage()}
            />
          </View>
        )}
        {months.data!.map((month) => (
          <Accordion
            key={month.month}
            icon={Megaphone}
            title={format.period(month.month)}
            subtitle={t(month.count === 1 ? 'sections.announcements.countOne' : 'sections.announcements.count', {
              count: month.count,
            })}
            expanded={sections.isOpen(month.month, month.month === openKey)}
            onToggle={() => sections.toggle(month.month, month.month === openKey)}>
            {residenceId !== undefined && (
              <MonthAnnouncements
                residenceId={residenceId}
                month={month.month}
                category={category}
                onOpen={openAnnouncement}
              />
            )}
          </Accordion>
        ))}
        {months.data!.length === 0 &&
          (filter !== 'all' ? (
            <EmptyState
              domain="announcements"
              title={t('announcements.filterEmpty.title')}
              description={t('announcements.filterEmpty.body')}
            />
          ) : (
            !hasPinned && (
              <EmptyState
                domain="announcements"
                title={t('announcements.empty.title')}
                description={t(canPublish ? 'announcements.empty.bodyManager' : 'announcements.empty.body')}
              />
            )
          ))}
      </>
    );
  }

  return (
    <Screen scroll onRefresh={() => void refreshAll()} refreshing={months.isRefetching}>
      {flash !== undefined && <Toast message={t(flash)} />}
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {active.name}
          </Text>
        )}
        <Text variant="h2">{t('announcements.title')}</Text>
      </View>
      {loaded && (hasPinned || monthKeys.length > 0 || filter !== 'all') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ gap: spacing.sm }}>
          {ANNOUNCEMENT_FILTERS.map((value) => (
            <Chip
              key={value}
              label={t(announcementFilterLabelKey(value))}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </ScrollView>
      )}
      {canPublish && <Button icon={Plus} label={t('announcements.new')} onPress={() => router.push('/new-announcement')} />}
      {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
      {loaded && months.isRefetchError && <Banner message={t('announcements.loadError')} />}
      {body}
    </Screen>
  );
}
