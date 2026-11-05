// Écran temporaire (plan 02) : vitrine des composants de @syndic/ui en français et en arabe.
// Les textes sont en dur à titre de test : les traductions arriveront avec les écrans métier.
import { Avatar, Card, Screen, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';

const copy = {
  fr: {
    title: 'Tableau de bord',
    designSystem: 'Design system',
    designSystemHint: 'Ouvre l’écran de démonstration (développement)',
    apiTitle: 'API : ok',
    apiBody: 'Coupure d’eau de 9 h à 13 h pour le nettoyage des réservoirs.',
    apiNote: 'Exemple statique : la vraie vérification arrivera avec les écrans.',
    person: 'Yassine Alaoui',
    role: 'Trésorier',
    pressTitle: 'Carte appuyable',
    pressCount: (count: number) => `Appuyée ${count} fois`,
  },
  ar: {
    title: 'لوحة القيادة',
    designSystem: 'نظام التصميم',
    designSystemHint: 'يفتح شاشة العرض (وضع التطوير)',
    apiTitle: 'واجهة API: تعمل',
    apiBody: 'انقطاع الماء من الساعة 9 إلى 13 لتنظيف الخزانات.',
    apiNote: 'مثال ثابت: التحقق الفعلي سيأتي مع الشاشات.',
    person: 'ياسين العلوي',
    role: 'أمين المال',
    pressTitle: 'بطاقة قابلة للضغط',
    pressCount: (count: number) => `عدد الضغطات: ${count}`,
  },
} as const;

export default function HomeScreen() {
  const { language, spacing } = useTheme();
  const t = copy[language];
  const [pressCount, setPressCount] = useState(0);
  const router = useRouter();

  return (
    <Screen scroll>
      <Text variant="h2">{t.title}</Text>

      <LanguageToggle />

      {__DEV__ && (
        <Card
          onPress={() => router.push('/dev/design-system')}
          accessibilityLabel={t.designSystem}
          accessibilityHint={t.designSystemHint}>
          <Text variant="bodyStrong" tone="primary">
            {t.designSystem}
          </Text>
          <Text variant="small" tone="muted">
            {t.designSystemHint}
          </Text>
        </Card>
      )}

      <Card>
        <Text variant="h3" tone="success">
          {t.apiTitle}
        </Text>
        <Text>{t.apiBody}</Text>
        <Text variant="small" tone="muted">
          {t.apiNote}
        </Text>
      </Card>

      <Card>
        {/* flexDirection « row » s'inverse en arabe : l'avatar passe à droite. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={t.person} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t.person}</Text>
            <Text variant="small" tone="muted">
              {t.role}
            </Text>
          </View>
          <Avatar name="Rachid Tazi" />
        </View>
      </Card>

      <Card
        onPress={() => setPressCount((count) => count + 1)}
        accessibilityLabel={`${t.pressTitle}, ${t.pressCount(pressCount)}`}>
        <Text variant="bodyStrong">{t.pressTitle}</Text>
        <Text variant="small" tone="muted">
          {t.pressCount(pressCount)}
        </Text>
      </Card>
    </Screen>
  );
}
