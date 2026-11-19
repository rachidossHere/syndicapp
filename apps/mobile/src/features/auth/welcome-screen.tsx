// Écran 5 de docs/design-v2.png : bienvenue, avant la connexion. Grande image en haut (l'image IA
// `welcome.webp` si elle existe, sinon une illustration SVG dans le même cadre) qui se fond vers le
// fond sable, logo texte, titre, sous-titre, puis « Créer un compte » et « J'ai déjà un compte ».
// Affiché seulement sans session (groupe (auth)) ; une invitation (`invite/[code]`) garde son parcours.
import { Appear, Button, GradientFill, Text, WelcomeScene, useTheme } from '@syndic/ui';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { useT } from '@/i18n/use-t';
import { welcomeArtFor } from '@/lib/welcome-art';
import { WELCOME_IMAGE } from '@/lib/welcome-image';

export function WelcomeScreen() {
  const { colors, spacing, layout, sizes, motion } = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const art = welcomeArtFor(WELCOME_IMAGE);
  const artHeight = Math.round(height * sizes.welcomeImageShare);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Apparition par fondu et léger glissement : l'image, puis le titre, puis les boutons (370 ms au
            total, jamais plus de 400). Tout est à sa place et appuyable dès le premier instant. */}
        <Appear testID="welcome-art" style={{ height: artHeight, overflow: 'hidden' }}>
          {art.kind === 'image' ? (
            <Image
              testID="welcome-image"
              source={art.source}
              contentFit="cover"
              accessible={false}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <WelcomeScene testID="welcome-scene" />
          )}
          {/* Fondu vers le fond sable, au bas de l'image. */}
          <GradientFill
            from={colors.bg}
            to={colors.bg}
            fromOpacity={0}
            toOpacity={1}
            style={{ top: undefined, height: sizes.welcomeFade }}
          />
        </Appear>

        <View
          style={{
            flex: 1,
            justifyContent: 'space-between',
            gap: spacing.xxl,
            paddingHorizontal: layout.screenPadding,
            paddingBottom: insets.bottom + spacing.xl,
          }}>
          <Appear delay={motion.stagger * 2} style={{ gap: spacing.sm }}>
            {/* En développement, un appui long sur le logo ouvre l'écran du design system. */}
            <Pressable
              accessibilityRole="header"
              accessibilityLabel={t('welcome.logoLabel')}
              onLongPress={__DEV__ ? () => router.push('/dev/design-system') : undefined}
              style={{
                alignSelf: 'flex-start',
                minHeight: sizes.touchTarget,
                justifyContent: 'center',
              }}>
              <Text variant="caption" tone="primary">
                {t('welcome.logoText')}
              </Text>
            </Pressable>
            <Text variant="h1">{t('welcome.title')}</Text>
            <Text tone="muted">{t('welcome.subtitle')}</Text>
          </Appear>

          <Appear delay={motion.stagger * 3} style={{ gap: spacing.sm }}>
            <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
            <Button variant="ghost" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
          </Appear>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          top: insets.top + spacing.sm,
          end: layout.screenPadding,
        }}>
        <LanguageToggle />
      </View>
    </View>
  );
}
