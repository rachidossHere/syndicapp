// Zone « Ajouter une photo » (écran 2 de docs/signalements.png) : appareil photo, ou galerie par le
// lien en dessous. Une fois la photo choisie, l'aperçu avec le badge « Photo ajoutée » ; toucher
// l'aperçu permet de la reprendre, d'en choisir une autre ou de la retirer.
import { Badge, Icon, Text, useTheme } from '@syndic/ui';
import { Image } from 'expo-image';
import Camera from 'lucide-react-native/icons/camera';
import { Alert, Pressable, View } from 'react-native';

import { useT } from '@/i18n/use-t';
import type { InvoiceFile } from '@/lib/invoice';

export type PhotoZoneProps = {
  photo: InvoiceFile | undefined;
  /** Désactive la zone (envoi en cours). */
  disabled: boolean;
  /** Préparation en cours (compression de l'image). */
  busy: boolean;
  onTakePhoto: () => void;
  onChooseImage: () => void;
  onRemove: () => void;
};

export function PhotoZone({ photo, disabled, busy, onTakePhoto, onChooseImage, onRemove }: PhotoZoneProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const t = useT();
  const inactive = disabled || busy;

  const askChange = () =>
    Alert.alert(t('issues.photo.changeTitle'), undefined, [
      { text: t('issues.photo.retake'), onPress: onTakePhoto },
      { text: t('issues.photo.another'), onPress: onChooseImage },
      { text: t('issues.photo.remove'), style: 'destructive', onPress: onRemove },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const frame = {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: borderWidth.thin,
    overflow: 'hidden',
  } as const;

  if (photo !== undefined) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('issues.photo.changeLabel')}
        disabled={inactive}
        onPress={askChange}
        style={{
          ...frame,
          height: sizes.invoiceZone,
          borderColor: colors.primary,
          backgroundColor: colors.surface,
        }}>
        <Image
          source={{ uri: photo.uri }}
          contentFit="cover"
          accessibilityLabel={t('issues.photo.previewLabel')}
          style={{ width: '100%', height: '100%' }}
        />
        <Badge
          label={t('issues.photo.added')}
          tone="success"
          style={{ position: 'absolute', top: spacing.sm, end: spacing.sm }}
        />
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('issues.photo.add')}
        disabled={inactive}
        onPress={onTakePhoto}
        style={{
          ...frame,
          height: sizes.photoZone,
          borderStyle: 'dashed',
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactive ? 0.6 : 1,
        }}>
        <Icon icon={Camera} color={colors.iconInactive} />
        <Text variant="bodyStrong">{busy ? t('issues.photo.preparing') : t('issues.photo.add')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('issues.photo.or')}
        disabled={inactive}
        onPress={onChooseImage}
        style={{ minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="small" tone="muted">
          {t('issues.photo.or')}
        </Text>
      </Pressable>
    </View>
  );
}
