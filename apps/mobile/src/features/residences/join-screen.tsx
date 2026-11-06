// Écrans 5 et 6 de docs/residences.png : rejoindre avec un code (le lien profond arrive ici code rempli).
import { Badge, Banner, Button, Card, Screen, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useAcceptInvitation, useInvitationPreview } from '@/hooks/use-invitations';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { isCompleteInviteCode, sanitizeInviteInput } from '@/lib/invite-code';

import { CodeInput } from './code-input';
import { useRoleLabel } from './use-role-label';

export function JoinScreen({ initialCode }: { initialCode?: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const [code, setCode] = useState(() => sanitizeInviteInput(initialCode ?? ''));
  const accept = useAcceptInvitation();

  // Un autre lien profond ouvert pendant que l'écran est affiché remplace le code saisi.
  useEffect(() => {
    if (initialCode !== undefined) setCode(sanitizeInviteInput(initialCode));
  }, [initialCode]);

  const complete = isCompleteInviteCode(code) ? code : null;
  const preview = useInvitationPreview(complete);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const onChange = (next: string) => {
    setCode(next);
    accept.reset();
  };

  const onJoin = async () => {
    if (complete === null || accept.isPending || preview.data === undefined) return;
    try {
      await accept.mutateAsync(complete);
      router.replace('/home');
    } catch {
      // L'erreur est affichée sous le champ ; le code reste saisi.
    }
  };

  const previewNetworkFailure = preview.error instanceof ApiError && preview.error.status === 0;
  const previewError = preview.error ? apiErrorKey(preview.error) : undefined;

  const row = (label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
      <Text tone="muted">{label}</Text>
      <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label={t('join.submit')}
            disabled={preview.data === undefined}
            loading={accept.isPending}
            onPress={() => void onJoin()}
          />
          <Button variant="ghost" label={t('join.notMine')} onPress={goBack} />
        </>
      }>
      <AuthHeader onBack={goBack} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="h2">{t('join.title')}</Text>
        <Text tone="muted">{t('join.subtitle')}</Text>
      </View>

      <CodeInput
        value={code}
        onChange={onChange}
        label={t('join.codeLabel')}
        editable={!accept.isPending}
        error={previewError !== undefined && !previewNetworkFailure}
        autoFocus={initialCode === undefined}
      />

      {complete !== null && preview.isFetching && <Text tone="muted">{t('join.checking')}</Text>}

      {previewError !== undefined &&
        (previewNetworkFailure ? (
          <ErrorNotice errorKey={previewError} onRetry={() => void preview.refetch()} retrying={preview.isFetching} />
        ) : (
          <Banner message={t(previewError)} />
        ))}

      {accept.error && <Banner message={t(apiErrorKey(accept.error))} />}

      {preview.data !== undefined && (
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
              <Text variant="h3" style={{ flex: 1 }}>
                {preview.data.residence.name}
              </Text>
              <Badge tone="success" label={t('join.valid')} />
            </View>
            {row(t('join.city'), preview.data.residence.city)}
            {preview.data.lotReference !== null && row(t('join.lot'), preview.data.lotReference)}
            {row(t('join.role'), roleLabel(preview.data.role))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
