// Bouton de test du plan 08 : n'est affiché qu'en développement (voir notifications-screen.tsx,
// `__DEV__`) ; il n'existe pas dans une version de production. On choisit le type de notification à
// simuler, puis une notification locale arrive 5 secondes plus tard : la toucher ouvre l'écran lié.
import { NOTIFICATION_TYPES, type NotificationType } from '@syndic/shared';
import { Banner, Button, Chip, Text, useTheme } from '@syndic/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { simulateNotification, type SimulationResult } from '@/lib/simulate-notification';
import { useLanguage } from '@/providers/language-provider';

export function SimulateNotificationButton({ residenceId }: { residenceId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const [type, setType] = useState<NotificationType>('announcement');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationResult | undefined>();

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    setResult(undefined);
    setResult(await simulateNotification(residenceId, language, type));
    setBusy(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="small" tone="muted">
        {t('announcements.simulate.hint')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {NOTIFICATION_TYPES.map((value) => (
          <Chip
            key={value}
            label={t(`notifications.type.${value}.title`)}
            selected={type === value}
            onPress={() => {
              setType(value);
              setResult(undefined);
            }}
          />
        ))}
      </View>
      <Button variant="secondary" label={t('announcements.simulate.button')} loading={busy} onPress={() => void onPress()} />
      {result === 'scheduled' && <Banner tone="info" message={t('announcements.simulate.scheduled')} />}
      {result === 'no_announcement' && <Banner message={t('announcements.simulate.noAnnouncement')} />}
      {result === 'no_issue' && <Banner message={t('notifications.simulate.noIssue')} />}
      {result === 'denied' && <Banner message={t('announcements.simulate.denied')} />}
      {result === 'failed' && <Banner message={t('announcements.simulate.failed')} />}
    </View>
  );
}
