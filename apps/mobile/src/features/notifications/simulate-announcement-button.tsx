// Bouton de test du plan 08 : n'est affiché qu'en développement (voir notifications-screen.tsx,
// `__DEV__`) ; il n'existe pas dans une version de production.
import { Banner, Button, Text, useTheme } from '@syndic/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { useLanguage } from '@/providers/language-provider';
import { simulateAnnouncementNotification, type SimulationResult } from '@/lib/simulate-announcement-notification';

export function SimulateAnnouncementButton({ residenceId }: { residenceId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationResult | undefined>();

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    setResult(undefined);
    setResult(await simulateAnnouncementNotification(residenceId, language));
    setBusy(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="small" tone="muted">
        {t('announcements.simulate.hint')}
      </Text>
      <Button variant="secondary" label={t('announcements.simulate.button')} loading={busy} onPress={() => void onPress()} />
      {result === 'scheduled' && <Banner tone="info" message={t('announcements.simulate.scheduled')} />}
      {result === 'no_announcement' && <Banner message={t('announcements.simulate.noAnnouncement')} />}
      {result === 'denied' && <Banner message={t('announcements.simulate.denied')} />}
      {result === 'failed' && <Banner message={t('announcements.simulate.failed')} />}
    </View>
  );
}
