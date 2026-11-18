// Écran 4 de docs/annonces.png : « Nouvelle annonce » (announcements.write seulement : sinon retour
// à l'accueil). Catégorie en puces, titre, message, interrupteur « Épingler en haut », texte « Les N
// membres de la résidence seront prévenus ». Le bouton « Publier l'annonce » est désactivé tant que le
// formulaire est invalide, et pendant l'envoi (qui n'est pas idempotent : pas de double envoi).
// Après la publication : confirmation, retour à la liste déjà rafraîchie.
import { Banner, Button, Chip, Icon, Screen, SwitchRow, Text, TextField, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useAnnouncementAudience, usePublishAnnouncement } from '@/hooks/use-announcements';
import { useActiveResidence } from '@/hooks/use-residences';
import { useErrorText } from '@/i18n/use-error-text';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import {
  ANNOUNCEMENT_CATEGORIES,
  DEFAULT_ANNOUNCEMENT_FORM,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  announcementFormSchema,
  announcementInputFrom,
  audienceNoteKey,
  canPublishAnnouncement,
  canSubmitAnnouncement,
  categoryLabelKey,
  type AnnouncementFormValues,
} from '@/lib/announcements';
import { setFlashMessage } from '@/lib/flash-message';
import { schemaResolver } from '@/lib/form-resolver';

export function NewAnnouncementScreen() {
  const { colors, radius, spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && canPublishAnnouncement(active.role);
  const residenceId = allowed ? active.id : undefined;
  const publish = usePublishAnnouncement(residenceId);
  const audience = useAnnouncementAudience(residenceId, allowed);
  const sending = useRef(false);
  const [failure, setFailure] = useState<string | undefined>();

  const { control, handleSubmit, setValue, watch, formState } = useForm<AnnouncementFormValues>({
    resolver: schemaResolver(announcementFormSchema),
    defaultValues: DEFAULT_ANNOUNCEMENT_FORM,
    mode: 'onChange',
  });
  const values = watch();

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const saving = formState.isSubmitting || publish.isPending;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/announcements'));

  const submitForm = handleSubmit(async (input) => {
    const body = announcementInputFrom(input);
    if (body === undefined || sending.current) return;
    sending.current = true;
    setFailure(undefined);
    try {
      await publish.mutateAsync(body);
      setFlashMessage('announcements.toast.published');
      goBack();
    } catch (error) {
      // Le brouillon est conservé : le formulaire reste rempli, « Publier » permet de réessayer.
      setFailure(apiErrorKey(error));
    } finally {
      sending.current = false;
    }
  });

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('announcements.submit')}
          loading={saving}
          disabled={!canSubmitAnnouncement(values) || saving}
          onPress={() => void submitForm()}
        />
      }>
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('announcements.form.title')}</Text>

      {failure !== undefined && <ErrorNotice errorKey={failure} onRetry={() => void submitForm()} retrying={saving} />}

      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('announcements.field.category')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ANNOUNCEMENT_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={t(categoryLabelKey(category))}
                selected={values.category === category}
                disabled={saving}
                onPress={() => setValue('category', category, { shouldValidate: true })}
              />
            ))}
          </View>
        </View>

        <Controller
          control={control}
          name="title"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('announcements.field.title')}
              placeholder={t('announcements.field.titlePlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              // Une erreur n'apparaît qu'après la saisie : un champ vide n'affiche rien, le bouton reste grisé.
              error={value === '' ? undefined : errorText(fieldState.error?.message)}
              editable={!saving}
              maxLength={MAX_ANNOUNCEMENT_TITLE_LENGTH + 20}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="body"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('announcements.field.body')}
              placeholder={t('announcements.field.bodyPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={value === '' ? undefined : errorText(fieldState.error?.message)}
              editable={!saving}
              lines={5}
              maxLength={MAX_ANNOUNCEMENT_BODY_LENGTH + 100}
            />
          )}
        />

        <Controller
          control={control}
          name="pinned"
          render={({ field: { value, onChange } }) => (
            <SwitchRow
              label={t('announcements.pinToggle.label')}
              description={t('announcements.pinToggle.description')}
              value={value}
              onValueChange={onChange}
              disabled={saving}
            />
          )}
        />

        {audience.isError && <Banner tone="info" message={t(audienceNoteKey(undefined))} />}
        {!audience.isError && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.primarySoft,
            }}>
            <Icon icon={Bell} color={colors.primary} />
            <Text variant="small" tone="primary" style={{ flex: 1 }}>
              {t(audienceNoteKey(audience.data), { count: audience.data ?? 0 })}
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
