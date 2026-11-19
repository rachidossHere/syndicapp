// Galerie de la refonte visuelle (plan 02b, étape 1), réservée au développement : route
// /dev/design-v2, déclarée dans Stack.Protected (guard __DEV__) et ouverte depuis l'accueil.
// Elle montre les nouvelles couleurs, les huit icônes en pastille, le motif zellige et
// PressableScale, pour les vérifier sur l'iPhone en français et en arabe (et avec « Réduire les
// animations »).
import {
  Accordion,
  ActionTile,
  AnimatedAmount,
  Appear,
  Button,
  CATEGORY_ART_CATEGORIES,
  CategoryArt,
  Card,
  DOMAINS,
  EMPTY_DOMAINS,
  EmptyState,
  EntranceRow,
  Icon,
  ListItem,
  PressableScale,
  ResidenceHero,
  Screen,
  Skeleton,
  Text,
  Toast,
  WelcomeScene,
  ZelligePattern,
  useListEntrance,
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
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const EMPTY_LABELS = {
  issues: 'domainIssues',
  announcements: 'domainAnnouncements',
  charges: 'domainCharges',
  expenses: 'domainExpenses',
  apartments: 'domainApartments',
  generic: 'domainGeneric',
} as const satisfies Record<(typeof EMPTY_DOMAINS)[number], keyof DesignV2Copy>;

const CATEGORY_LABELS = {
  works: 'catWorks',
  meeting: 'catMeeting',
  info: 'catInfo',
  urgent: 'catUrgent',
} as const satisfies Record<(typeof CATEGORY_ART_CATEGORIES)[number], keyof DesignV2Copy>;

/** Valeurs d'exemple de la galerie : durée d'affichage du toast, éléments de la cascade, solde en centimes. */
const GALLERY_TOAST_MS = 3000;
const GALLERY_CASCADE_ROWS = 10;
const GALLERY_BALANCE = 1_842_000;
const GALLERY_BALANCE_BUMP = 45_000;

const BRAND_COLORS = [
  { token: 'tealDeep', label: 'brandTealDeep' },
  { token: 'terracotta', label: 'brandTerracotta' },
  { token: 'saffron', label: 'brandSaffron' },
  { token: 'palm', label: 'brandPalm' },
] as const;

export function DesignV2Screen() {
  const { language, spacing, colors, radius, sizes, borderWidth, domainColors, motion } = useTheme();
  const t = designV2Copy[language];
  const reducedMotion = useReducedMotion();
  const [pressCount, setPressCount] = useState(0);
  const [smallCount, setSmallCount] = useState(0);
  const [replay, setReplay] = useState(0);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

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
              }}>
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
          }}>
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
          <View style={{ overflow: 'hidden', gap: spacing.xs, minHeight: sizes.actionTileMinHeight }}>
            <ZelligePattern />
            <Text variant="h3">{t.lightTitle}</Text>
            <Text tone="muted">{t.lightBody}</Text>
          </View>
        </Card>
      </Section>

      <Section title={t.illustrations}>
        <Text variant="bodyStrong">{t.hero}</Text>
        <ResidenceHero name={t.headerTitle} roleLabel={t.headerKicker} />
        <ResidenceHero name={t.heroLong} roleLabel={t.headerKicker} />
        <Text variant="bodyStrong">{t.emptyStates}</Text>
        {EMPTY_DOMAINS.map((domain) => (
          <Card key={domain}>
            <EmptyState domain={domain} title={t[EMPTY_LABELS[domain]]} description={t.lightBody} />
          </Card>
        ))}
        <Text variant="bodyStrong">{t.categoryArt}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {CATEGORY_ART_CATEGORIES.map((category) => (
            <View key={category} style={{ alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  width: sizes.categoryBand,
                  height: sizes.categoryBanner,
                  overflow: 'hidden',
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                }}>
                <CategoryArt category={category} />
              </View>
              <Text variant="caption">{t[CATEGORY_LABELS[category]]}</Text>
            </View>
          ))}
        </View>
        <Text variant="bodyStrong">{t.welcomeScene}</Text>
        <View
          style={{
            height: sizes.emptyCircle * 2,
            overflow: 'hidden',
            borderRadius: radius.lg,
            borderCurve: 'continuous',
          }}>
          <WelcomeScene />
        </View>
      </Section>

      <Section title={t.pressable}>
        <Text variant="small" tone="muted">
          {t.pressableHint}
        </Text>
        <Text variant="bodyStrong">{`${t.reducedMotion} : ${reducedMotion ? t.reducedOn : t.reducedOff}`}</Text>
        <PressableScale accessibilityLabel={t.pressableCard} onPress={() => setPressCount((count) => count + 1)}>
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
          <PressableScale accessibilityLabel={t.pressableSmall} onPress={() => setSmallCount((count) => count + 1)}>
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.primarySoft,
              }}>
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

      <Section title={t.animations}>
        <Text variant="small" tone="muted">
          {t.animationsHint}
        </Text>
        <Text variant="bodyStrong">{`${t.reducedMotion} : ${reducedMotion ? t.reducedOn : t.reducedOff}`}</Text>
        <Button variant="secondary" label={t.animReplay} onPress={() => setReplay((count) => count + 1)} />

        <Text variant="bodyStrong">{t.animTouch}</Text>
        <ActionTile label={t.animTile} icon={Wallet} domain="charges" onPress={() => undefined} />
        <ListItem title={t.animRowTitle} subtitle={t.animRowSub} onPress={() => undefined} />
        <Button label={t.animButton} onPress={() => undefined} />

        <Text variant="bodyStrong">{t.animCascade}</Text>
        <Text variant="small" tone="muted">
          {t.animCascadeHint}
        </Text>
        <CascadeDemo key={`cascade-${replay}`} label={t.animItem} />

        <Text variant="bodyStrong">{t.animAccordion}</Text>
        <Accordion
          icon={Building}
          title={t.animAccordionTitle}
          subtitle={t.animAccordionSub}
          expanded={accordionOpen}
          onToggle={() => setAccordionOpen((open) => !open)}>
          <ListItem title={t.animAccordionLine} />
        </Accordion>

        <Text variant="bodyStrong">{t.animToast}</Text>
        <Text variant="small" tone="muted">
          {t.animToastHint}
        </Text>
        <Button
          variant="secondary"
          label={t.animToastShow}
          onPress={() => {
            clearTimeout(toastTimer.current);
            setToastVisible(true);
            toastTimer.current = setTimeout(() => setToastVisible(false), GALLERY_TOAST_MS);
          }}
        />
        {toastVisible && <Toast message={t.animToastText} />}

        <Text variant="bodyStrong">{t.animSkeleton}</Text>
        <Text variant="small" tone="muted">
          {t.animSkeletonHint}
        </Text>
        <Card>
          <Skeleton width="45%" />
          <Skeleton width="65%" height={spacing.xxxl} />
          <Skeleton height={spacing.sm} rounded="pill" />
        </Card>

        <Text variant="bodyStrong">{t.animCount}</Text>
        <Text variant="small" tone="muted">
          {t.animCountHint}
        </Text>
        <CountDemo key={`count-${replay}`} bumpLabel={t.animCountBump} />

        <Text variant="bodyStrong">{t.animAppear}</Text>
        <Text variant="small" tone="muted">
          {t.animAppearHint}
        </Text>
        <View key={`appear-${replay}`} style={{ gap: spacing.md }}>
          <Appear>
            <Card>
              <Text variant="bodyStrong">{t.animAppearSlide}</Text>
            </Card>
          </Appear>
          <Appear slide={false} delay={motion.stagger * 2}>
            <Card>
              <Text variant="bodyStrong">{t.animAppearFade}</Text>
            </Card>
          </Appear>
        </View>
      </Section>
    </Screen>
  );
}

/** Dix éléments : seuls les huit premiers apparaissent en cascade (la fenêtre d'un premier affichage). */
function CascadeDemo({ label }: { label: string }) {
  const { spacing } = useTheme();
  const entrance = useListEntrance(true);
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: GALLERY_CASCADE_ROWS }, (_, index) => (
        <EntranceRow key={index} entrance={entrance} index={index}>
          <ListItem title={label.replace('{n}', String(index + 1))} />
        </EntranceRow>
      ))}
    </View>
  );
}

/** Le solde compte jusqu'à sa valeur à l'affichage, puis change directement quand il est mis à jour. */
function CountDemo({ bumpLabel }: { bumpLabel: string }) {
  const { spacing } = useTheme();
  const [centimes, setCentimes] = useState(GALLERY_BALANCE);
  return (
    <Card style={{ gap: spacing.md }}>
      <AnimatedAmount centimes={centimes} variant="display" />
      <Button
        variant="secondary"
        label={bumpLabel}
        onPress={() => setCentimes((value) => value + GALLERY_BALANCE_BUMP)}
      />
    </Card>
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
