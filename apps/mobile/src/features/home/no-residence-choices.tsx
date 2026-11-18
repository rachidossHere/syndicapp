// Compte sans résidence : deux choix (créer sa résidence, rejoindre avec un code d'invitation).
import { Card, Icon, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import KeyRound from 'lucide-react-native/icons/key-round';
import Plus from 'lucide-react-native/icons/plus';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';

export function NoResidenceChoices() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();

  const choices = [
    {
      key: 'create',
      icon: Plus,
      domain: 'residence',
      title: t('home.createResidenceTitle'),
      body: t('home.createResidenceBody'),
      onPress: () => router.push('/create-residence'),
    },
    {
      key: 'join',
      icon: KeyRound,
      domain: 'members',
      title: t('home.joinResidenceTitle'),
      body: t('home.joinResidenceBody'),
      onPress: () => router.push('/join'),
    },
  ] as const;

  return (
    <View style={{ gap: spacing.md }}>
      <Text tone="muted">{t('home.noResidence')}</Text>
      {choices.map((choice) => (
        <Card key={choice.key} onPress={choice.onPress} accessibilityLabel={`${choice.title}. ${choice.body}`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <Icon icon={choice.icon} variant="tile" domain={choice.domain} tileSize="sm" />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="h3">{choice.title}</Text>
              <Text variant="small" tone="muted">
                {choice.body}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
