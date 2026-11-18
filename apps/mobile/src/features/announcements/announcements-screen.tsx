// Écrans 3 et 7 de docs/annonces.png : « Annonces », pour tous les rôles.
// Annonces épinglées en tête (carte « Épinglée »), puis de la plus récente à la plus ancienne ;
// chargement de la suite en faisant défiler (curseur), « tirer pour actualiser », rafraîchissement au
// retour sur l'écran, états chargement, erreur réseau et vide. Seuls announcements.write (syndic,
// adjoint) voient le bouton « Nouvelle annonce » : l'API refuse de toute façon les autres rôles.
import { Banner, Button, EmptyState, Screen, Text, Toast, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useAnnouncementList } from '@/hooks/use-announcements';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { announcementsResidenceId, canPublishAnnouncement } from '@/lib/announcements';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';

import { AnnouncementListFooter } from './announcement-list-footer';
import { AnnouncementRow } from './announcement-row';

/** Durée d'affichage de la confirmation « Annonce publiée ». */
const TOAST_MS = 4000;

export function AnnouncementsScreen() {
  const { colors, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = announcementsResidenceId(active);
  const canPublish = canPublishAnnouncement(active?.role);
  const list = useAnnouncementList(residenceId);
  const flash = useFlashMessage();

  // Rafraîchissement au retour sur l'écran (après une publication, un épinglage).
  useRefreshOnFocus(list.refetch);

  useEffect(() => {
    if (flash === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const openAnnouncement = (id: string) => router.push({ pathname: '/announcement/[id]', params: { id } });

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
        <Text variant="h2">{t('announcements.title')}</Text>
      </View>
      {canPublish && <Button icon={Plus} label={t('announcements.new')} onPress={() => router.push('/new-announcement')} />}
      {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
      {list.loaded && list.isRefetchError && <Banner message={t('announcements.loadError')} />}
    </View>
  );

  // Jamais d'état vide pendant le premier chargement : « Chargement… » ou l'erreur avec « Réessayer ».
  const empty = !list.loaded ? (
    <QueryFallback
      query={{ error: list.error, isFetching: list.isFetching, refetch: list.refetch }}
      message={t('announcements.loadError')}
    />
  ) : (
    <EmptyState
      icon={Megaphone}
      title={t('announcements.empty.title')}
      description={t(canPublish ? 'announcements.empty.bodyManager' : 'announcements.empty.body')}
    />
  );

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        data={list.loaded ? list.items : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnnouncementRow item={item} onOpen={openAnnouncement} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: list.items.length > 0 ? 0 : spacing.md }}
        ListEmptyComponent={empty}
        ListFooterComponent={<AnnouncementListFooter list={list} />}
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
