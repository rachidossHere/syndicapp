// Écran 2 de docs/signalements.png : « Signaler un problème » (titre, emplacement en puces, détails
// facultatifs, photo facultative, interrupteur « C'est urgent »).
// Enregistrement : photo vers R2 (progression) → création avec la clé de la photo. L'API des
// signalements n'accepte pas de client_id : l'envoi n'est pas idempotent, donc le bouton est
// désactivé pendant l'envoi (verrou aussi contre le double appui) ; la photo déjà envoyée n'est pas
// renvoyée à un nouvel essai.
import { Banner, Button, Chip, ProgressBar, Screen, SwitchRow, Text, TextField, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useCreateIssue } from '@/hooks/use-issues';
import { useActiveResidence } from '@/hooks/use-residences';
import { useErrorText } from '@/i18n/use-error-text';
import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { setFlashMessage } from '@/lib/flash-message';
import { schemaResolver } from '@/lib/form-resolver';
import { issueErrorKey } from '@/lib/issue-api';
import type { UploadedPhoto } from '@/lib/issue-save';
import {
  ISSUE_LOCATIONS,
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  canUseIssues,
  issueFieldsFrom,
  issueFormSchema,
  type IssueFormValues,
} from '@/lib/issues';

import { PhotoZone } from './photo-zone';
import { useIssuePhotoPicker } from './use-photo-picker';

const key = (value: string) => value as TranslationKey;

export function NewIssueScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const errorText = useErrorText();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && canUseIssues(active.role);
  const create = useCreateIssue(allowed ? active.id : undefined);

  const uploaded = useRef<UploadedPhoto | undefined>(undefined);
  const sending = useRef(false);
  const picker = useIssuePhotoPicker();
  const [progress, setProgress] = useState<number | undefined>();
  const [failure, setFailure] = useState<string | undefined>();

  const { control, handleSubmit, setValue, formState } = useForm<IssueFormValues>({
    resolver: schemaResolver(issueFormSchema),
    defaultValues: { title: '', location: '', description: '', urgent: false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const saving = formState.isSubmitting;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/issues'));

  const submitForm = handleSubmit(async (input) => {
    const fields = issueFieldsFrom(input);
    if (fields === undefined) return;
    const photo = picker.photo;
    setFailure(undefined);
    setProgress(photo === undefined ? undefined : 0);
    try {
      await create.mutateAsync({ fields, photo, uploaded, onProgress: setProgress });
      setFlashMessage('issues.toast.sent');
      goBack();
    } catch (caught) {
      // La saisie et la photo déjà envoyée restent : « Réessayer » ne renvoie pas la photo.
      setFailure(issueErrorKey(caught));
    } finally {
      setProgress(undefined);
      sending.current = false;
    }
  });
  // Pas de double envoi : le verrou couvre aussi la touche « Terminé » du clavier.
  const onSubmit = () => {
    if (saving || sending.current) return;
    sending.current = true;
    void submitForm().finally(() => {
      sending.current = false;
    });
  };

  const percent = Math.round((progress ?? 0) * 100);
  const uploading = saving && picker.photo !== undefined && progress !== undefined && progress < 1;
  const photoError = errorText(picker.errorKey);

  return (
    <Screen
      scroll
      footer={
        <>
          {uploading && (
            <View style={{ gap: spacing.xs }}>
              <ProgressBar value={progress ?? 0} accessibilityLabel={t('issues.uploading', { percent })} />
              <Text variant="small" tone="muted">
                {t('issues.uploading', { percent })}
              </Text>
            </View>
          )}
          <Button label={t('issues.submit')} loading={saving} disabled={picker.busy} onPress={onSubmit} />
        </>
      }>
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('issues.form.title')}</Text>

      {failure !== undefined && <ErrorNotice errorKey={failure} onRetry={onSubmit} retrying={saving} />}

      <View style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="title"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('issues.field.title')}
              placeholder={t('issues.field.titlePlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!saving}
              maxLength={MAX_ISSUE_TITLE_LENGTH + 20}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="location"
          render={({ field: { value }, fieldState }) => (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('issues.field.location')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {ISSUE_LOCATIONS.map((location) => (
                  <Chip
                    key={location}
                    label={t(key(`issues.location.${location}`))}
                    selected={value === location}
                    disabled={saving}
                    onPress={() => setValue('location', location, { shouldValidate: formState.isSubmitted })}
                  />
                ))}
              </View>
              {fieldState.error?.message !== undefined && (
                <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
                  {errorText(fieldState.error.message)}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { ref, value, onChange, onBlur }, fieldState }) => (
            <TextField
              ref={ref}
              label={t('issues.field.description')}
              placeholder={t('issues.field.descriptionPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errorText(fieldState.error?.message)}
              editable={!saving}
              lines={3}
              maxLength={MAX_ISSUE_DESCRIPTION_LENGTH + 100}
            />
          )}
        />

        <View style={{ gap: spacing.sm }}>
          <PhotoZone
            photo={picker.photo}
            disabled={saving}
            busy={picker.busy}
            onTakePhoto={() => void picker.takePhoto()}
            onChooseImage={() => void picker.chooseImage()}
            onRemove={picker.remove}
          />
          {photoError !== undefined && <Banner message={photoError} />}
        </View>

        <Controller
          control={control}
          name="urgent"
          render={({ field: { value, onChange } }) => (
            <SwitchRow
              label={t('issues.urgent.label')}
              description={t('issues.urgent.description')}
              value={value}
              onValueChange={onChange}
              disabled={saving}
            />
          )}
        />
      </View>
    </Screen>
  );
}
