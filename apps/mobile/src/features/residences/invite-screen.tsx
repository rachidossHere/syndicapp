// Écran 4 de docs/residences.png : inviter un voisin (création) ou revoir une invitation en attente.
import { can, inviteLink, type Role } from '@syndic/shared';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import * as Clipboard from 'expo-clipboard';
import { Redirect, useRouter } from 'expo-router';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import { useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import {
  useCancelInvitation,
  useCreateInvitation,
  usePendingInvitations,
  type NewInvitation,
} from '@/hooks/use-invitations';
import { useLots } from '@/hooks/use-lots';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { daysUntil, formatInviteCode } from '@/lib/invite-code';

import { useRoleLabel } from './use-role-label';

/** Rôles proposés au syndic dans l'écran d'invitation. */
const OFFERED_ROLES = ['owner', 'tenant', 'caretaker'] as const satisfies readonly NewInvitation['role'][];
type OfferedRole = (typeof OFFERED_ROLES)[number];

/** Durée d'affichage du toast, en millisecondes. */
const TOAST_MS = 3000;

type ShownInvitation = { id: string; code: string; role: Role; expiresAt: string; lotReference: string | null };

export type InviteScreenProps = {
  /** Création : appartement présélectionné (venant de la liste). */
  lotId?: string;
  /** Consultation : invitation en attente à afficher (avec « Annuler l'invitation »). */
  invitationId?: string;
};

export function InviteScreen({ lotId, invitationId }: InviteScreenProps) {
  const { spacing } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'members.invite');
  const residenceId = allowed ? active.id : undefined;

  const lots = useLots(lotId !== undefined ? residenceId : undefined);
  const pending = usePendingInvitations(residenceId, invitationId !== undefined);
  const createInvitation = useCreateInvitation(residenceId);
  const cancelInvitation = useCancelInvitation(residenceId);

  const [role, setRole] = useState<OfferedRole>('owner');
  const [created, setCreated] = useState<ShownInvitation | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/lots'));
  const lot = lots.data?.find((item) => item.id === lotId);
  const existing = pending.data?.find((item) => item.id === invitationId);
  const shown: ShownInvitation | undefined = created ?? existing;

  const onCreate = async () => {
    if (createInvitation.isPending) return;
    setError(undefined);
    // Le gardien n'est pas rattaché à un appartement ; copropriétaire et locataire le sont.
    const needsLot = role !== 'caretaker';
    if (needsLot && lot === undefined) {
      setError(t('invitations.errors.lotNotFound'));
      return;
    }
    try {
      const result = await createInvitation.mutateAsync({ role, lotId: needsLot ? lot?.id : undefined });
      setCreated({
        id: result.id,
        code: result.code,
        role: result.role,
        expiresAt: result.expiresAt,
        lotReference: needsLot ? (lot?.reference ?? null) : null,
      });
    } catch (caught) {
      setError(t(apiErrorKey(caught)));
    }
  };

  const onShare = async () => {
    if (!shown || active === null) return;
    try {
      await Share.share({
        message: t('invite.shareMessage', {
          residence: active.name,
          role: roleLabel(shown.role, { lower: true }),
          code: formatInviteCode(shown.code),
          link: inviteLink(shown.code),
        }),
      });
    } catch {
      // Feuille de partage indisponible : rien à faire, le code reste affiché.
    }
  };

  const onCopy = async () => {
    if (!shown) return;
    try {
      await Clipboard.setStringAsync(shown.code);
      setToast(t('invite.copied'));
    } catch {
      setError(t('auth.errors.unknown'));
    }
  };

  const confirmCancel = () => {
    if (!shown) return;
    Alert.alert(t('invite.cancelTitle'), t('invite.cancelBody'), [
      { text: t('invite.cancelKeep'), style: 'cancel' },
      {
        text: t('invite.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          setError(undefined);
          cancelInvitation.mutate(shown.id, {
            onSuccess: goBack,
            onError: (caught) => setError(t(apiErrorKey(caught))),
          });
        },
      },
    ]);
  };

  const header = (
    <>
      <AuthHeader onBack={goBack} />
      <Text variant="h2">{t('invite.title')}</Text>
    </>
  );

  // Consultation d'une invitation : chargement, erreur, ou invitation déjà utilisée / annulée.
  if (invitationId !== undefined && shown === undefined) {
    return (
      <Screen scroll>
        {header}
        {pending.error ? (
          <ErrorNotice
            errorKey={apiErrorKey(pending.error)}
            onRetry={() => void pending.refetch()}
            retrying={pending.isFetching}
          />
        ) : pending.data === undefined ? (
          <Text tone="muted">{t('common.loading')}</Text>
        ) : (
          <EmptyState
            title={t('invite.notFound')}
            action={<Button variant="secondary" label={t('lots.list.title')} onPress={() => router.replace('/lots')} />}
          />
        )}
      </Screen>
    );
  }

  const footer =
    shown === undefined ? (
      <Button label={t('invite.create')} loading={createInvitation.isPending} onPress={() => void onCreate()} />
    ) : (
      <>
        <Button icon={Share2} label={t('invite.share')} onPress={() => void onShare()} />
        <Button variant="secondary" icon={Copy} label={t('invite.copy')} onPress={() => void onCopy()} />
        {invitationId !== undefined && (
          <Button
            variant="ghost"
            label={t('invite.cancel')}
            loading={cancelInvitation.isPending}
            onPress={confirmCancel}
          />
        )}
      </>
    );

  const days = shown ? daysUntil(shown.expiresAt) : 0;

  return (
    <Screen scroll footer={footer}>
      {header}
      {toast !== undefined && <Toast message={toast} />}
      {error !== undefined && <Banner message={error} />}

      {shown === undefined ? (
        <View style={{ gap: spacing.lg }}>
          {lotId !== undefined && role !== 'caretaker' && (
            <TextField
              label={t('invite.lot')}
              value={lot?.reference ?? ''}
              editable={false}
              ltr
              helper={lots.isLoading ? t('common.loading') : undefined}
            />
          )}
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('invite.role')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {OFFERED_ROLES.map((value) => (
                <Chip
                  key={value}
                  label={roleLabel(value)}
                  selected={role === value}
                  disabled={createInvitation.isPending}
                  onPress={() => setRole(value)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {shown.lotReference !== null && (
            <View style={{ gap: spacing.xs }}>
              <Text variant="small" tone="muted">
                {t('invite.lot')}
              </Text>
              <Text variant="bodyStrong">{`${shown.lotReference} · ${roleLabel(shown.role)}`}</Text>
            </View>
          )}
          {shown.lotReference === null && <Text variant="bodyStrong">{roleLabel(shown.role)}</Text>}

          <Card>
            <View style={{ alignItems: 'center', gap: spacing.md }}>
              <Text variant="small" tone="muted">
                {t('invite.codeLabel')}
              </Text>
              <Text
                variant="display"
                tone="primary"
                selectable
                accessibilityLabel={`${t('invite.codeLabel')} ${[...shown.code].join(' ')}`}
                style={{ writingDirection: 'ltr' }}>
                {formatInviteCode(shown.code)}
              </Text>
              <Badge tone="warning" label={days === 1 ? t('invite.validityOne') : t('invite.validity', { days })} />
              <Text variant="small" tone="muted" selectable style={{ writingDirection: 'ltr' }}>
                {inviteLink(shown.code)}
              </Text>
            </View>
          </Card>

          <Text variant="small" tone="muted">
            {t('invite.help')}
          </Text>
        </View>
      )}
    </Screen>
  );
}
