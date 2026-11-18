// Carte « Dernière annonce » de l'accueil (écran 2 de docs/design-v2.png), pour tous les rôles :
// bandeau illustré de la catégorie (même illustration que la liste), badge, titre, auteur et date.
// Cachée tant que la requête charge, en cas d'erreur (l'accueil ne doit pas être perturbé) et
// quand la résidence n'a aucune annonce.
import { PressableScale, Text, CategoryArt, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useLatestAnnouncement } from '@/hooks/use-announcements';
import { useT } from '@/i18n/use-t';
import { categoryLabelKey, latestAnnouncementToShow } from '@/lib/announcements';

import { CategoryBadge } from './announcement-row';
import { useAnnouncementFormat } from './use-announcement-format';

export function LatestAnnouncementCard({ residenceId }: { residenceId: string }) {
  const { colors, radius, sizes, spacing, borderWidth } = useTheme();
  const t = useT();
  const router = useRouter();
  const { meta } = useAnnouncementFormat();
  const latest = useLatestAnnouncement(residenceId);
  const item = latestAnnouncementToShow(latest.data);

  if (item === null) return null;

  const metaText = meta(item);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="h3">{t('announcements.latest.title')}</Text>
      <PressableScale
        onPress={() => router.push({ pathname: '/announcement/[id]', params: { id: item.id } })}
        accessibilityLabel={[
          t('announcements.latest.title'),
          t('announcements.rowLabel', { title: item.title, category: t(categoryLabelKey(item.category)) }),
          metaText,
        ].join(', ')}>
        <View
          style={{
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: borderWidth.thin,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
          }}>
          <View style={{ height: sizes.categoryBanner }}>
            <CategoryArt category={item.category} />
          </View>
          <View style={{ gap: spacing.xs, padding: spacing.lg, alignItems: 'flex-start' }}>
            <CategoryBadge category={item.category} />
            <Text variant="h3">{item.title}</Text>
            <Text variant="small" tone="muted">
              {metaText}
            </Text>
          </View>
        </View>
      </PressableScale>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('announcements.latest.seeAll')}
        onPress={() => router.navigate('/announcements')}
        style={{ minHeight: sizes.touchTarget, justifyContent: 'center' }}>
        <Text variant="bodyStrong" tone="primary">
          {t('announcements.latest.seeAll')}
        </Text>
      </Pressable>
    </View>
  );
}
