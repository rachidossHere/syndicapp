// Photo d'un signalement (écrans 3 et 5) : URL signée demandée à l'ouverture et jamais gardée plus
// de 4 minutes (hooks/use-issues.ts), cadre avec badge « Photo », chargement et erreur avec « Réessayer ».
import { Badge, Button, Text, useTheme } from '@syndic/ui';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useIssuePhoto } from '@/hooks/use-issues';
import { useT } from '@/i18n/use-t';
import type { IssueDetail } from '@/lib/issues';

export function IssuePhoto({ residenceId, issue }: { residenceId: string; issue: Pick<IssueDetail, 'id' | 'hasPhoto'> }) {
  const { colors, radius, sizes, spacing, borderWidth } = useTheme();
  const t = useT();
  const photo = useIssuePhoto(residenceId, issue.id, issue.hasPhoto);
  if (!issue.hasPhoto) return null;

  const frame = {
    height: sizes.invoiceZone,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  if (photo.data === undefined) {
    return (
      <View style={frame}>
        <Text tone="muted" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
          {t(photo.error ? 'issues.detail.photoError' : 'issues.detail.photoLoading')}
        </Text>
        {photo.error && (
          <Button variant="ghost" label={t('common.retry')} loading={photo.isFetching} onPress={() => void photo.refetch()} />
        )}
      </View>
    );
  }
  return (
    <View style={frame}>
      <Image
        source={{ uri: photo.data }}
        contentFit="cover"
        // Mémoire seulement : l'URL signée et la photo ne sont pas écrites sur le disque.
        cachePolicy="memory"
        accessibilityLabel={t('issues.photo.previewLabel')}
        style={{ width: '100%', height: '100%' }}
      />
      <Badge
        label={t('issues.detail.photoBadge')}
        tone="info"
        style={{ position: 'absolute', bottom: spacing.sm, end: spacing.sm }}
      />
    </View>
  );
}
