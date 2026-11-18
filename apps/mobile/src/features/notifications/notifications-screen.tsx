// Écran 2 de docs/annonces.png : « Notifications », interrupteurs par type.
// Les préférences sont liées à l'utilisateur ; « Signalements urgents » n'apparaît que pour les rôles
// avec issues.manage dans la résidence active. « Annonces urgentes » est verrouillée (toujours activée).
import { Banner, Button, Icon, IconButton, Screen, SwitchRow, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Info from 'lucide-react-native/icons/info';
import Lock from 'lucide-react-native/icons/lock';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { SimulateNotificationButton } from './simulate-notification-button';
import { useNotificationPreferences, useSetNotificationPreference } from '@/hooks/use-notification-preferences';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';
import { pushDeps } from '@/lib/push-device';
import {
  enablePush,
  notificationRows,
  permissionNotice,
  type NotificationRow,
  type PermissionState,
} from '@/lib/push-registration';

/** Autorisation système, relue au retour dans l'appli (après les réglages du téléphone). */
function usePermission() {
  const [permission, setPermission] = useState<PermissionState | undefined>();
  const refresh = useCallback(async () => {
    try {
      setPermission(await pushDeps.getPermission());
    } catch {
      setPermission('undetermined');
    }
  }, []);
  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return { permission, refresh };
}

export function NotificationsScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();
  const { active } = useActiveResidence();
  const preferences = useNotificationPreferences();
  const setPreference = useSetNotificationPreference();
  const { permission, refresh } = usePermission();
  const [enabling, setEnabling] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const rows = notificationRows(active?.role ?? null);
  const notice = permission === undefined ? 'none' : permissionNotice(permission);

  const onEnable = async () => {
    if (enabling) return;
    setEnabling(true);
    await enablePush(pushDeps);
    await refresh();
    setEnabling(false);
  };

  const renderRow = ({ type, locked }: NotificationRow) => (
    <SwitchRow
      key={type}
      label={t(`notifications.type.${type}.title`)}
      description={t(`notifications.type.${type}.body`)}
      value={locked ? true : (preferences.data?.[type] ?? true)}
      // Verrouillé : toujours activé, l'interrupteur ne répond pas (l'API refuse aussi de le couper).
      disabled={locked}
      onValueChange={(enabled) => setPreference.mutate({ type, enabled })}
    />
  );

  return (
    <Screen
      scroll
      footer={
        notice === 'open_settings' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.warningBg,
            }}>
            <Icon icon={Info} color={colors.warningFg} />
            <View style={{ flex: 1 }}>
              <Text variant="small" tone="warning">
                {t('notifications.denied.title')}
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('notifications.denied.action')}
                onPress={() => void Linking.openSettings()}
                style={{ minHeight: sizes.touchTarget, justifyContent: 'center' }}>
                <Text variant="bodyStrong" tone="warning" style={{ textDecorationLine: 'underline' }}>
                  {t('notifications.denied.action')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : undefined
      }>
      <View style={{ alignItems: 'flex-start' }}>
        <IconButton icon={ChevronLeft} flipInRtl accessibilityLabel={t('common.back')} onPress={goBack} />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text variant="h1">{t('notifications.title')}</Text>
        <Text tone="muted">{t('notifications.subtitle')}</Text>
      </View>

      {notice === 'enable' && (
        <View style={{ gap: spacing.md }}>
          <Banner tone="info" message={t('notifications.undetermined.body')} />
          <Button label={t('notifications.intro.enable')} loading={enabling} onPress={() => void onEnable()} />
        </View>
      )}

      {preferences.data === undefined ? (
        preferences.error ? (
          <ErrorNotice
            errorKey={apiErrorKey(preferences.error)}
            onRetry={() => void preferences.refetch()}
            retrying={preferences.isFetching}
          />
        ) : (
          <Text tone="muted">{t('common.loading')}</Text>
        )
      ) : (
        <View style={{ gap: spacing.md }}>
          {setPreference.isError && <Banner message={t('notifications.saveError')} />}
          {rows.general.map((row) =>
            row.locked ? (
              <View key={row.type} style={{ gap: spacing.xs }}>
                {renderRow(row)}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm }}>
                  <Icon icon={Lock} color={colors.textMuted} />
                  <Text variant="small" tone="muted">
                    {t('notifications.locked')}
                  </Text>
                </View>
              </View>
            ) : (
              renderRow(row)
            ),
          )}
          {rows.office.length > 0 && (
            <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
              <Text variant="bodyStrong">{t('notifications.office')}</Text>
              {rows.office.map(renderRow)}
            </View>
          )}
        </View>
      )}

      {/* Développement seulement : jamais affiché dans une version de production. */}
      {__DEV__ && active !== null && <SimulateNotificationButton residenceId={active.id} />}
    </Screen>
  );
}
