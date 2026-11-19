// Ligne d'un signalement dans les listes (habitant et personnel) : icône de l'emplacement, titre,
// sous-titre fourni par l'écran, badge de statut et badge « Urgent » (jamais la couleur seule).
import { Badge, Banner, Button, Icon, ListItem, StatusBadge, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import type { IssueItem } from '@/lib/issues';

import { LOCATION_ICONS } from './location-icon';

export function IssueRow({
  issue,
  subtitle,
  onOpen,
  showStatus = true,
}: {
  issue: IssueItem;
  subtitle: string;
  onOpen: (id: string) => void;
  /** Faux dans une section « par statut » : le statut est déjà dans le titre de la section. */
  showStatus?: boolean;
}) {
  const t = useT();
  const { colors, radius, sizes, spacing } = useTheme();

  return (
    <ListItem
      title={issue.title}
      subtitle={subtitle}
      accessibilityLabel={[
        t('issues.rowLabel', { title: issue.title, status: t(`issues.status.${issue.status}`) }),
        ...(issue.urgent && issue.status !== 'resolved' ? [t('issues.urgent')] : []),
        subtitle,
      ].join(', ')}
      leading={
        <View
          style={{
            width: sizes.iconBox,
            height: sizes.iconBox,
            borderRadius: radius.sm,
            borderCurve: 'continuous',
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={LOCATION_ICONS[issue.location]} color={colors.primary} />
        </View>
      }
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          {showStatus && <StatusBadge status={issue.status} />}
          {issue.urgent && issue.status !== 'resolved' && <Badge tone="danger" label={t('issues.urgent')} />}
        </View>
      }
      onPress={() => onOpen(issue.id)}
    />
  );
}

type ListFooterState = {
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};

/** Pied de liste : « Chargement… » de la page suivante, ou son erreur avec « Réessayer ». */
export function IssueListFooter({ list, note }: { list: ListFooterState; note?: string }) {
  const { spacing } = useTheme();
  const t = useT();
  return (
    <View style={{ gap: spacing.md }}>
      {list.isFetchNextPageError ? (
        <View style={{ gap: spacing.sm }}>
          <Banner message={t('issues.loadMoreError')} />
          <Button
            variant="secondary"
            label={t('common.retry')}
            loading={list.isFetchingNextPage}
            onPress={() => void list.fetchNextPage()}
          />
        </View>
      ) : list.isFetchingNextPage ? (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {t('common.loading')}
        </Text>
      ) : null}
      {note !== undefined && (
        <Text variant="small" tone="muted">
          {note}
        </Text>
      )}
    </View>
  );
}
