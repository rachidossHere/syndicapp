// Grande zone « Prendre la facture en photo » (écran 2 de docs/depenses.png) ; une fois la facture
// choisie, l'aperçu avec le badge « Facture ajoutée » (écran 3). Toucher l'aperçu permet de
// reprendre la photo, de choisir un autre fichier ou de retirer la facture.
import { Badge, Icon, Text, useTheme } from '@syndic/ui';
import { Image } from 'expo-image';
import Camera from 'lucide-react-native/icons/camera';
import FileText from 'lucide-react-native/icons/file-text';
import { Alert, Pressable, View } from 'react-native';

import { useT } from '@/i18n/use-t';
import type { InvoiceFile } from '@/lib/invoice';

export type InvoiceZoneProps = {
  invoice: InvoiceFile | undefined;
  /** Désactive la zone (envoi en cours). */
  disabled: boolean;
  /** Préparation en cours (compression de l'image). */
  busy: boolean;
  onTakePhoto: () => void;
  onChooseImage: () => void;
  onChoosePdf: () => void;
  onRemove: () => void;
};

export function InvoiceZone({
  invoice,
  disabled,
  busy,
  onTakePhoto,
  onChooseImage,
  onChoosePdf,
  onRemove,
}: InvoiceZoneProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const t = useT();
  const inactive = disabled || busy;

  /** « ou choisir une image ou un PDF » : galerie ou PDF, dans une feuille native. */
  const askSource = () =>
    Alert.alert(t('expenses.invoice.chooseTitle'), undefined, [
      { text: t('expenses.invoice.gallery'), onPress: onChooseImage },
      { text: t('expenses.invoice.pdf'), onPress: onChoosePdf },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  /** Facture déjà ajoutée : reprendre la photo, choisir un autre fichier ou retirer. */
  const askChange = () =>
    Alert.alert(t('expenses.invoice.changeTitle'), undefined, [
      { text: t('expenses.invoice.retake'), onPress: onTakePhoto },
      { text: t('expenses.invoice.another'), onPress: askSource },
      { text: t('expenses.invoice.remove'), style: 'destructive', onPress: onRemove },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const frame = {
    height: sizes.invoiceZone,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: borderWidth.thin,
    overflow: 'hidden',
  } as const;

  if (invoice !== undefined) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('expenses.invoice.changeLabel')}
        disabled={inactive}
        onPress={askChange}
        style={{
          ...frame,
          borderColor: colors.primary,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {invoice.kind === 'image' ? (
          <Image
            source={{ uri: invoice.uri }}
            contentFit="contain"
            accessibilityLabel={t('expenses.invoice.previewLabel')}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <Icon icon={FileText} color={colors.primary} />
            <Text variant="bodyStrong" numberOfLines={2} style={{ textAlign: 'center' }}>
              {invoice.name ?? t('expenses.invoice.pdf')}
            </Text>
          </View>
        )}
        <Badge
          label={t('expenses.invoice.added')}
          tone="success"
          style={{ position: 'absolute', top: spacing.sm, end: spacing.sm }}
        />
      </Pressable>
    );
  }

  return (
    <View
      style={{
        ...frame,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        opacity: inactive ? 0.6 : 1,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('expenses.invoice.take')}
        disabled={inactive}
        onPress={onTakePhoto}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
        <Icon icon={Camera} color={colors.iconInactive} />
        <Text variant="bodyStrong">{busy ? t('expenses.invoice.preparing') : t('expenses.invoice.take')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('expenses.invoice.or')}
        disabled={inactive}
        onPress={askSource}
        style={{
          minHeight: sizes.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}>
        <Text variant="small" tone="muted">
          {t('expenses.invoice.or')}
        </Text>
      </Pressable>
    </View>
  );
}
