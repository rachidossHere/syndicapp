// Carte « Dernière annonce » de l'accueil (écran 5 de docs/annonces.png), pour tous les rôles.
// Cachée tant que la requête charge, en cas d'erreur (l'accueil ne doit pas être perturbé) et
// quand la résidence n'a aucune annonce.
import { Card, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useLatestAnnouncement } from '@/hooks/use-announcements';
import { useT } from '@/i18n/use-t';
import { categoryLabelKey } from '@/lib/announcements';

import { CategoryBadge } from './announcement-row';
import { useAnnouncementFormat } from './use-announcement-format';

export function LatestAnnouncementCard({ residenceId }: { residenceId: string }) {
  const { sizes, spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { meta } = useAnnouncementFormat();
  const latest = useLatestAnnouncement(residenceId);
  const item = latest.data;

  if (item === undefined || item === null) return null;

  const metaText = meta(item);
  return (
    <Card
      onPress={() => router.push({ pathname: '/announcement/[id]', params: { id: item.id } })}
      accessibilityLabel={[t('announcements.latest.title'), t('announcements.rowLabel', { title: item.title, category: t(categoryLabelKey(item.category)) }), metaText].join(', ')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="caption" tone="muted">
          {t('announcements.latest.title')}
        </Text>
        <CategoryBadge category={item.category} />
      </View>
      <Text variant="h3">{item.title}</Text>
      <Text variant="small" tone="muted">
        {metaText}
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('announcements.latest.seeAll')}
        onPress={() => router.push('/announcements')}
        style={{ minHeight: sizes.touchTarget, justifyContent: 'center' }}>
        <Text variant="bodyStrong" tone="primary">
          {t('announcements.latest.seeAll')}
        </Text>
      </Pressable>
    </Card>
  );
}
