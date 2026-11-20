// Ce que le contenu d'une section en accordéon peut afficher en plus de ses lignes : chargement, erreur
// avec « Réessayer », et « Afficher plus » (pagination dans la section).
import { Banner, Button, Skeleton, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';

/** Section qu'on vient d'ouvrir : deux lignes grises tiennent la place des éléments qui arrivent. */
export function SectionLoading() {
  const { spacing, sizes } = useTheme();
  const t = useT();
  return (
    <View accessible accessibilityLabel={t('common.loading')} style={{ gap: spacing.md }}>
      <Skeleton height={sizes.touchTarget} rounded="lg" />
      <Skeleton height={sizes.touchTarget} rounded="lg" />
    </View>
  );
}

/** Les éléments de la section n'ont pas pu être chargés : message et « Réessayer ». */
export function SectionError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { spacing } = useTheme();
  const t = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <Banner message={t('sections.loadError')} />
      <Button variant="secondary" label={t('common.retry')} loading={retrying} onPress={onRetry} />
    </View>
  );
}

/**
 * Pagination d'une section : « Afficher plus » tant qu'il reste des éléments. Un échec de la page suivante
 * garde les lignes déjà affichées et propose « Réessayer ».
 */
export function LoadMore({
  hasNextPage,
  pending,
  failed,
  onPress,
}: {
  hasNextPage: boolean;
  pending: boolean;
  failed: boolean;
  onPress: () => void;
}) {
  const { spacing } = useTheme();
  const t = useT();
  if (!hasNextPage && !failed) return null;
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
      {failed && <Banner message={t('sections.loadMoreError')} />}
      <Button
        variant="secondary"
        label={t(failed ? 'common.retry' : 'sections.loadMore')}
        loading={pending}
        onPress={onPress}
      />
    </View>
  );
}
