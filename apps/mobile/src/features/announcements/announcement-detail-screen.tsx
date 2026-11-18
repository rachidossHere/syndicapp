// Détail d'une annonce : catégorie, titre, texte complet, auteur par son rôle, date, et
// « Épingler » / « Désépingler » pour announcements.write. Ouvert depuis la liste, l'accueil ou au
// toucher d'une notification d'annonce.
import { Banner, Button, Screen, Text, Toast, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Pin from 'lucide-react-native/icons/pin';
import PinOff from 'lucide-react-native/icons/pin-off';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useAnnouncement, usePinAnnouncement } from '@/hooks/use-announcements';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { announcementsResidenceId, canPublishAnnouncement } from '@/lib/announcements';

import { CategoryBadge } from './announcement-row';
import { useAnnouncementFormat } from './use-announcement-format';

const TOAST_MS = 4000;

export function AnnouncementDetailScreen({ announcementId }: { announcementId: string | undefined }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { meta } = useAnnouncementFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = announcementsResidenceId(active);
  const canPublish = canPublishAnnouncement(active?.role);
  const announcement = useAnnouncement(residenceId, announcementId);
  const pin = usePinAnnouncement(residenceId, announcementId ?? '');
  const [toast, setToast] = useState<'announcements.toast.pinned' | 'announcements.toast.unpinned' | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/announcements'));
  const item = announcement.data;

  const onTogglePin = () => {
    if (item === undefined || pin.isPending) return;
    const next = !item.pinned;
    pin.mutate(next, { onSuccess: () => setToast(next ? 'announcements.toast.pinned' : 'announcements.toast.unpinned') });
  };

  return (
    <Screen scroll>
      <AuthHeader onBack={goBack} />
      {toast !== undefined && <Toast message={t(toast)} />}
      {item === undefined ? (
        <QueryFallback
          query={{ error: announcement.error, isFetching: announcement.isFetching, refetch: announcement.refetch }}
          message={t('announcements.loadError')}
        />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
            <CategoryBadge category={item.category} />
            {item.pinned && (
              <Text variant="caption" tone="primary">
                {t('announcements.pinned')}
              </Text>
            )}
          </View>
          <Text variant="h2">{item.title}</Text>
          <Text variant="small" tone="muted">
            {meta(item)}
          </Text>
          <Text selectable>{item.body}</Text>
          {canPublish && (
            <View style={{ gap: spacing.sm }}>
              {pin.isError && <Banner message={t('announcements.pinError')} />}
              <Button
                variant="secondary"
                icon={item.pinned ? PinOff : Pin}
                label={t(item.pinned ? 'announcements.unpin' : 'announcements.pin')}
                loading={pin.isPending}
                onPress={onTogglePin}
              />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
