// Galerie de la refonte visuelle (plan 02b, étape 1), réservée au développement : route
// /dev/design-v2, déclarée dans Stack.Protected (guard __DEV__) et ouverte depuis l'accueil.
// Elle montre les nouvelles couleurs, les huit icônes en pastille, le motif zellige et
// PressableScale, pour les vérifier sur l'iPhone en français et en arabe (et avec « Réduire les
// animations »).
import {
  Card,
  DOMAINS,
  Icon,
  PressableScale,
  Screen,
  Text,
  ZelligePattern,
  useReducedMotion,
  useTheme,
  type Domain,
  type IconComponent,
} from '@syndic/ui';
import Bell from 'lucide-react-native/icons/bell';
import Building from 'lucide-react-native/icons/building';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Flag from 'lucide-react-native/icons/flag';
import Megaphone from 'lucide-react-native/icons/megaphone';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';

import { designV2Copy, type DesignV2Copy } from './design-v2-copy';

type GalleryIcon = { icon: IconComponent; domain: Domain; label: keyof DesignV2Copy };

/** Les huit icônes de la maquette docs/design-v2.png. */
const GALLERY_ICONS: readonly GalleryIcon[] = [
  { icon: Building, domain: 'residence', label: 'apartments' },
  { icon: Wallet, domain: 'charges', label: 'charges' },
  { icon: ChartColumn, domain: 'accounts', label: 'accounts' },
  { icon: ReceiptText, domain: 'expenses', label: 'expense' },
  { icon: Flag, domain: 'issues', label: 'issue' },
  { icon: Megaphone, domain: 'announcements', label: 'announcement' },
  { icon: Users, domain: 'members', label: 'members' },
  { icon: Bell, domain: 'notifications', label: 'notifications' },
];

const BRAND_COLORS = [
  { token: 'tealDeep', label: 'brandTealDeep' },
  { token: 'terracotta', label: 'brandTerracotta' },
  { token: 'saffron', label: 'brandSaffron' },
  { token: 'palm', label: 'brandPalm' },
] as const;

export function DesignV2Screen() {
  const { language, spacing, colors, radius, sizes, borderWidth, domainColors } = useTheme();
  const t = designV2Copy[language];
  const reducedMotion = useReducedMotion();
  const [pressCount, setPressCount] = useState(0);
  const [smallCount, setSmallCount] = useState(0);

  return (
    <Screen scroll>
      <LanguageToggle />

      <Section title={t.palette}>
        <Text variant="bodyStrong">{t.brand}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {BRAND_COLORS.map(({ token, label }) => (
            <View key={token} style={{ gap: spacing.xs, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: sizes.iconTile.lg,
                  height: sizes.iconTile.md,
                  borderRadius: radius.sm,
                  borderCurve: 'continuous',
                  backgroundColor: colors[token],
                }}
              />
              <Text variant="caption">{t[label]}</Text>
              <Text variant="small" tone="muted">
                {colors[token]}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodyStrong">{t.domains}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DOMAINS.map((domain) => (
            <View
              key={domain}
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: domainColors[domain].bg,
                borderWidth: borderWidth.thin,
                borderColor: colors.border,
              }}
            >
              <Text variant="caption" style={{ color: domainColors[domain].fg }}>
                {domain}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t.icons}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
          {GALLERY_ICONS.map(({ icon, domain, label }) => (
            <View key={domain} style={{ width: '25%', alignItems: 'center', gap: spacing.xs }}>
              <Icon icon={icon} domain={domain} variant="tile" tileSize="lg" />
              <Text variant="caption" style={{ textAlign: 'center' }}>
                {t[label]}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodyStrong">{t.iconSizes}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Icon icon={Wallet} domain="charges" variant="tile" tileSize="sm" />
          <Icon icon={Wallet} domain="charges" variant="tile" tileSize="md" />
          <Icon icon={Wallet} domain="charges" variant="tile" tileSize="lg" />
          <Text variant="small" tone="muted">{`${t.sizeSm} · ${t.sizeMd} · ${t.sizeLg}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Icon icon={Flag} domain="issues" variant="line" size={sizes.tabIcon} />
          <Text variant="small">{t.variantLine}</Text>
          <Icon icon={Flag} domain="issues" variant="duotone" size={sizes.tabIcon} />
          <Text variant="small">{t.variantDuotone}</Text>
        </View>
      </Section>

      <Section title={t.zellige}>
        <Text variant="small" tone="muted">
          {t.zelligeDark}
        </Text>
        <View
          style={{
            overflow: 'hidden',
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: colors.tealDeep,
            padding: spacing.xl,
            gap: spacing.xs,
            minHeight: sizes.actionTileMinHeight,
            justifyContent: 'flex-end',
          }}
        >
          <ZelligePattern color={colors.textInverse} />
          <Text variant="caption" tone="inverse">
            {t.headerKicker}
          </Text>
          <Text variant="h2" tone="inverse">
            {t.headerTitle}
          </Text>
        </View>
        <Text variant="small" tone="muted">
          {t.zelligeLight}
        </Text>
        <Card>
          <View
            style={{ overflow: 'hidden', gap: spacing.xs, minHeight: sizes.actionTileMinHeight }}
          >
            <ZelligePattern />
            <Text variant="h3">{t.lightTitle}</Text>
            <Text tone="muted">{t.lightBody}</Text>
          </View>
        </Card>
      </Section>

      <Section title={t.pressable}>
        <Text variant="small" tone="muted">
          {t.pressableHint}
        </Text>
        <Text variant="bodyStrong">
          {`${t.reducedMotion} : ${reducedMotion ? t.reducedOn : t.reducedOff}`}
        </Text>
        <PressableScale
          accessibilityLabel={t.pressableCard}
          onPress={() => setPressCount((count) => count + 1)}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon icon={Wallet} domain="charges" variant="tile" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t.pressableCard}</Text>
                <Text variant="small" tone="muted">
                  {t.pressableCount.replace('{count}', String(pressCount))}
                </Text>
              </View>
            </View>
          </Card>
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <PressableScale
            accessibilityLabel={t.pressableSmall}
            onPress={() => setSmallCount((count) => count + 1)}
          >
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.primarySoft,
              }}
            >
              <Text variant="caption" tone="primary">
                {`${t.pressableSmall} · ${smallCount}`}
              </Text>
            </View>
          </PressableScale>
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            {t.pressableSmallHint}
          </Text>
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { layout } = useTheme();
  return (
    <View style={{ gap: layout.listGap }}>
      <Text variant="h3">{title}</Text>
      {children}
    </View>
  );
}
