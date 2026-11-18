// Carte d'une annonce dans la liste (écran 3 de docs/design-v2.png) : bande illustrée de la
// catégorie (au début : à gauche en français, à droite en arabe), puis le badge de catégorie, le
// titre et « Épinglée · Le syndic · date ». Une annonce épinglée garde la bordure `primary`.
// La catégorie est toujours écrite (jamais la couleur ou l'illustration seule) ; l'auteur n'est jamais nommé.
import { Badge, CategoryArt, PressableScale, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { CATEGORY_TONES, categoryLabelKey, type AnnouncementCategory, type AnnouncementItem } from '@/lib/announcements';

import { useAnnouncementFormat } from './use-announcement-format';

export function CategoryBadge({ category }: { category: AnnouncementCategory }) {
  const t = useT();
  return <Badge tone={CATEGORY_TONES[category]} label={t(categoryLabelKey(category))} />;
}

export function AnnouncementRow({ item, onOpen }: { item: AnnouncementItem; onOpen: (id: string) => void }) {
  const t = useT();
  const { colors, radius, sizes, spacing, borderWidth } = useTheme();
  const { meta } = useAnnouncementFormat();
  const category = t(categoryLabelKey(item.category));
  const metaText = meta(item);
  const shownMeta = item.pinned ? t('announcements.pinnedMeta', { meta: metaText }) : metaText;

  return (
    <PressableScale
      onPress={() => onOpen(item.id)}
      accessibilityLabel={[
        t(item.pinned ? 'announcements.pinnedRowLabel' : 'announcements.rowLabel', { title: item.title, category }),
        metaText,
      ].join(', ')}>
      <View
        style={{
          flexDirection: 'row',
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderColor: item.pinned ? colors.primary : colors.border,
          borderWidth: item.pinned ? borderWidth.strong : borderWidth.thin,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
        }}>
        <View style={{ width: sizes.categoryBand }}>
          <CategoryArt category={item.category} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs, padding: spacing.md, alignItems: 'flex-start' }}>
          <CategoryBadge category={item.category} />
          <Text variant="bodyStrong">{item.title}</Text>
          <Text variant="small" tone="muted">
            {shownMeta}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}
