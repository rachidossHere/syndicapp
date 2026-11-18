// Ligne d'une annonce dans la liste (écrans 3 et 7 de docs/annonces.png) :
// - épinglée : carte mise en avant (bordure primary) avec « Épinglée », le badge de catégorie, le titre,
//   le début du texte et « Le syndic · date » ;
// - sinon : ligne avec l'icône de la catégorie, le titre, « Le syndic · date » et le badge de catégorie.
// La catégorie est toujours écrite (jamais la couleur seule) ; l'auteur n'est jamais nommé.
import { Badge, Card, Icon, ListItem, Text, useTheme } from '@syndic/ui';
import Info from 'lucide-react-native/icons/info';
import Pin from 'lucide-react-native/icons/pin';
import CircleExclamationPoint from 'lucide-react-native/icons/circle-exclamation-point';
import Users from 'lucide-react-native/icons/users';
import Wrench from 'lucide-react-native/icons/wrench';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { CATEGORY_TONES, categoryLabelKey, type AnnouncementCategory, type AnnouncementItem } from '@/lib/announcements';

import { useAnnouncementFormat } from './use-announcement-format';

const CATEGORY_ICONS = {
  works: Wrench,
  meeting: Users,
  info: Info,
  urgent: CircleExclamationPoint,
} as const;

/** Nombre de lignes du début du texte dans la carte épinglée. */
const PINNED_PREVIEW_LINES = 3;

export function CategoryBadge({ category }: { category: AnnouncementCategory }) {
  const t = useT();
  return <Badge tone={CATEGORY_TONES[category]} label={t(categoryLabelKey(category))} />;
}

export function AnnouncementRow({ item, onOpen }: { item: AnnouncementItem; onOpen: (id: string) => void }) {
  const t = useT();
  const { colors, radius, sizes, spacing } = useTheme();
  const { meta } = useAnnouncementFormat();
  const category = t(categoryLabelKey(item.category));
  const metaText = meta(item);

  if (item.pinned) {
    return (
      <Card
        highlighted
        onPress={() => onOpen(item.id)}
        accessibilityLabel={[t('announcements.pinnedRowLabel', { title: item.title, category }), metaText].join(', ')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon icon={Pin} color={colors.primary} />
            <Text variant="caption" tone="primary">
              {t('announcements.pinned')}
            </Text>
          </View>
          <CategoryBadge category={item.category} />
        </View>
        <Text variant="h3">{item.title}</Text>
        <Text numberOfLines={PINNED_PREVIEW_LINES}>{item.body}</Text>
        <Text variant="small" tone="muted">
          {metaText}
        </Text>
      </Card>
    );
  }

  const tone = CATEGORY_TONES[item.category];
  return (
    <ListItem
      title={item.title}
      subtitle={metaText}
      accessibilityLabel={[t('announcements.rowLabel', { title: item.title, category }), metaText].join(', ')}
      leading={
        <View
          style={{
            width: sizes.iconBox,
            height: sizes.iconBox,
            borderRadius: radius.sm,
            borderCurve: 'continuous',
            backgroundColor: colors[`${tone}Bg`],
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={CATEGORY_ICONS[item.category]} color={colors[`${tone}Fg`]} />
        </View>
      }
      trailing={<CategoryBadge category={item.category} />}
      onPress={() => onOpen(item.id)}
    />
  );
}
