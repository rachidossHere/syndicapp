// Écran 1 de docs/auth.png : accueil.
import { Button, Icon, Screen, Text, useTheme } from '@syndic/ui';
import { useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import Check from 'lucide-react-native/icons/check';
import { Pressable, View } from 'react-native';

import { useT } from '@/i18n/use-t';

import { AuthHeader } from './auth-header';

const BENEFITS = ['welcome.benefitCharges', 'welcome.benefitExpenses', 'welcome.benefitReports'] as const;

export function WelcomeScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();

  return (
    <Screen
      scroll
      contentStyle={{ flexGrow: 1 }}
      footer={
        <>
          <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
          <Button variant="secondary" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
        </>
      }>
      <AuthHeader />

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        {/* En développement, un appui long sur le logo ouvre l'écran du design system. */}
        <Pressable
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('welcome.logoLabel')}
          onLongPress={__DEV__ ? () => router.push('/dev/design-system') : undefined}
          style={{
            width: sizes.logo,
            height: sizes.logo,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon icon={Building} color={colors.textInverse} size={sizes.tabIcon} />
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{t('welcome.appName')}</Text>
          <Text tone="muted">{t('welcome.tagline')}</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {BENEFITS.map((key) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: sizes.iconBoxSm,
                  height: sizes.iconBoxSm,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon icon={Check} color={colors.primary} />
              </View>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
