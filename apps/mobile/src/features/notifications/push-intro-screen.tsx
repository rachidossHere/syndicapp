// Écran 1 de docs/annonces.png : « Restez informé », avant la demande système.
// Affiché une seule fois après la connexion. « Activer » déclenche la demande système puis
// enregistre le jeton ; « Plus tard » ferme sans rien demander.
import { Button, Card, Icon, Screen, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import Megaphone from 'lucide-react-native/icons/megaphone';
import MessageSquare from 'lucide-react-native/icons/message-square';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { introStore, pushDeps } from '@/lib/push-device';
import { enablePush } from '@/lib/push-registration';

export function PushIntroScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  // L'écran n'est plus jamais proposé, quel que soit le choix.
  const onEnable = async () => {
    if (busy) return;
    setBusy(true);
    introStore.markSeen();
    // Aucune erreur visible : un refus se règle dans l'écran « Notifications », un jeton
    // indisponible (Expo Go) est retenté à la prochaine ouverture.
    await enablePush(pushDeps);
    close();
  };
  const onLater = () => {
    introStore.markSeen();
    close();
  };

  const rows = [
    { key: 'announcements', icon: Megaphone, title: t('notifications.intro.announcements'), body: t('notifications.intro.announcementsBody') },
    { key: 'issues', icon: MessageSquare, title: t('notifications.intro.issues'), body: t('notifications.intro.issuesBody') },
    { key: 'charges', icon: CirclePlus, title: t('notifications.intro.charges'), body: t('notifications.intro.chargesBody') },
  ];

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('notifications.intro.enable')} loading={busy} onPress={() => void onEnable()} />
          <Button variant="ghost" label={t('notifications.intro.later')} disabled={busy} onPress={onLater} />
        </>
      }>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl }}>
        <View
          style={{
            width: sizes.iconBox * 2,
            height: sizes.iconBox * 2,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={Bell} color={colors.primary} size={sizes.iconBox} />
        </View>
        <Text variant="h2" style={{ textAlign: 'center' }}>
          {t('notifications.intro.title')}
        </Text>
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {t('notifications.intro.body')}
        </Text>
      </View>

      <Card>
        <View style={{ gap: spacing.lg }}>
          {rows.map((row) => (
            <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: sizes.iconBox,
                  height: sizes.iconBox,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={row.icon} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{row.title}</Text>
                <Text variant="small" tone="muted">
                  {row.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
        {t('notifications.intro.footnote')}
      </Text>
    </Screen>
  );
}
