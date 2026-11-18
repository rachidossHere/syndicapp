// Pied de la liste des annonces : « Chargement… » de la page suivante, ou son erreur avec « Réessayer ».
import { Banner, Button, Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';

type ListFooterState = {
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};

export function AnnouncementListFooter({ list }: { list: ListFooterState }) {
  const { spacing } = useTheme();
  const t = useT();
  if (list.isFetchNextPageError) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Banner message={t('announcements.loadMoreError')} />
        <Button
          variant="secondary"
          label={t('common.retry')}
          loading={list.isFetchingNextPage}
          onPress={() => void list.fetchNextPage()}
        />
      </View>
    );
  }
  if (list.isFetchingNextPage) {
    return (
      <Text tone="muted" style={{ textAlign: 'center' }}>
        {t('common.loading')}
      </Text>
    );
  }
  return null;
}
