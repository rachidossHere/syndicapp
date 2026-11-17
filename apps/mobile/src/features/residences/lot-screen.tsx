// Fiche d'un appartement (syndic, lots.write) : modifier la référence, supprimer l'appartement.
// Style du mode « Un par un » de docs/residences.png : champ, bouton principal en pied d'écran.
import { can } from '@syndic/shared';
import { Badge, Banner, Button, EmptyState, Screen, Text, TextField, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { usePendingInvitations } from '@/hooks/use-invitations';
import { useDeleteLot, useLots, useUpdateLot } from '@/hooks/use-lots';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { setFlashMessage } from '@/lib/flash-message';
import { canSaveReference, deleteState, referenceDraft } from '@/lib/lot-edit';

export function LotScreen({ lotId }: { lotId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'lots.write');
  const residenceId = allowed ? active.id : undefined;
  const lots = useLots(residenceId);
  const invitations = usePendingInvitations(active?.id, allowed);
  const updateLot = useUpdateLot(residenceId);
  const deleteLot = useDeleteLot(residenceId);

  // Brouillon : `undefined` tant que l'utilisateur n'a rien tapé (le champ montre la référence actuelle).
  const [draftText, setDraftText] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const lot = lots.data?.find((item) => item.id === lotId);
  const invitation = (invitations.data ?? []).find((item) => item.lotId === lotId);

  // L'API refuse de toute façon : l'écran n'est proposé qu'aux rôles qui ont `lots.write`.
  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const goToList = () => router.replace('/lots');
  const goBack = () => (router.canGoBack() ? router.back() : goToList());
  const busy = updateLot.isPending || deleteLot.isPending;

  const header = <AuthHeader onBack={goBack} />;

  if (lots.data === undefined) {
    return (
      <Screen scroll>
        {header}
        {lots.error ? (
          <ErrorNotice errorKey={apiErrorKey(lots.error)} onRetry={() => void lots.refetch()} retrying={lots.isFetching} />
        ) : (
          <Text tone="muted">{t('common.loading')}</Text>
        )}
      </Screen>
    );
  }

  if (lot === undefined) {
    return (
      <Screen scroll>
        {header}
        <EmptyState
          icon={Building}
          title={t('lot.notFoundTitle')}
          description={t('lot.notFoundBody')}
          action={<Button variant="secondary" label={t('common.back')} onPress={goToList} />}
        />
      </Screen>
    );
  }

  const draft = referenceDraft(draftText ?? lot.reference, lot.reference);
  const deletion = deleteState(lot.deleteBlocker);

  const save = () => {
    if (busy || !canSaveReference(draft)) return;
    setError(undefined);
    updateLot.mutate(
      { id: lot.id, reference: draft.value },
      {
        onSuccess: () => {
          setFlashMessage('lots.toast.updated');
          goToList();
        },
        // Le brouillon reste affiché : l'utilisateur corrige et réessaie.
        onError: (caught) => setError(t(apiErrorKey(caught))),
      },
    );
  };

  const confirmDelete = () => {
    if (busy || deletion.disabled) return;
    Alert.alert(t('lot.deleteTitle'), t('lot.deleteBody', { reference: lot.reference }), [
      { text: t('lot.deleteKeep'), style: 'cancel' },
      {
        text: t('lot.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setError(undefined);
          deleteLot.mutate(lot.id, {
            onSuccess: () => {
              setFlashMessage('lots.toast.deleted');
              goToList();
            },
            onError: (caught) => setError(t(apiErrorKey(caught))),
          });
        },
      },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label={t('lot.save')}
            disabled={!canSaveReference(draft)}
            loading={updateLot.isPending}
            onPress={save}
          />
          <Button
            variant="secondary"
            label={t('lot.delete')}
            disabled={deletion.disabled || busy}
            loading={deleteLot.isPending}
            onPress={confirmDelete}
          />
        </>
      }>
      {header}

      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {active.name}
          </Text>
        )}
        <Text variant="h2">{t('lot.title', { reference: lot.reference })}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Badge
            tone={lot.status === 'member' ? 'success' : lot.status === 'pending' ? 'warning' : 'info'}
            label={t(lot.status === 'free' ? 'lots.row.freeSubtitle' : `lots.status.${lot.status}`)}
          />
        </View>
      </View>

      {error !== undefined && <Banner message={error} />}

      <View style={{ gap: spacing.md }}>
        <TextField
          label={t('lot.reference')}
          value={draftText ?? lot.reference}
          onChangeText={(text) => {
            setDraftText(text);
            setError(undefined);
          }}
          onSubmitEditing={save}
          editable={!busy}
          maxLength={20}
          ltr
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          error={draftText !== undefined && !draft.valid ? t('lots.errors.referenceInvalid') : undefined}
        />
      </View>

      {lot.status === 'pending' && invitation !== undefined && (
        <Button
          variant="ghost"
          label={t('lot.viewInvitation')}
          onPress={() => router.push({ pathname: '/invitation/[id]', params: { id: invitation.id } })}
        />
      )}

      {/* Un appartement rattaché à un membre, une invitation, des charges… ne se supprime pas : la raison est dite. */}
      {deletion.reasonKey !== undefined && <Banner tone="info" message={t(deletion.reasonKey)} />}
    </Screen>
  );
}
