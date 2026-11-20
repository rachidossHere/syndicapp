import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { cssEaseOut, easeOut } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { useTheme } from '../theme/theme-provider';
import { accordionA11y, accordionChevron, chevronRotation } from './accordion-state';
import { Icon, type IconComponent } from './icon';
import { PressableSurface } from './pressable-surface';
import { Text } from './text';

export type AccordionHeaderProps = {
  /** Icône à gauche (début de ligne en français, fin en arabe), dans un carré `primarySoft`. */
  icon: IconComponent;
  title: string;
  subtitle?: string;
  /**
   * Élément à la fin de la ligne, avant le chevron : badge de statut (« 3 impayés », « Soldé »), nombre, montant.
   * Il ne porte jamais seul l'information : le sous-titre ou le libellé du badge la dit aussi.
   */
  trailing?: ReactNode;
  /** Texte de `trailing`, lu par les lecteurs d'écran avec le titre et le sous-titre. */
  trailingLabel?: string;
  /** Section ouverte : le chevron pointe vers le bas et l'état est annoncé. */
  expanded: boolean;
  onToggle: () => void;
  /** En-tête grisé et non appuyable (section vide). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * En-tête d'une section repliable : icône, titre, sous-titre et chevron. Zone tactile de 44 px au
 * moins, rôle « bouton » et état ouvert ou fermé annoncé. Seul, il sert d'en-tête de section d'une
 * liste ; avec `Accordion`, il est suivi de son contenu.
 *
 * Le chevron tourne (`motion.duration.normal`, courbe `out`) entre « vers le bas » (ouvert) et « vers la
 * fin de ligne » (fermé : vers la droite en français, vers la gauche en arabe). « Réduire les
 * animations » activé : il change de sens directement.
 */
export function AccordionHeader({
  icon,
  title,
  subtitle,
  trailing,
  trailingLabel,
  expanded,
  onToggle,
  disabled = false,
  style,
  testID,
}: AccordionHeaderProps) {
  const { colors, radius, spacing, sizes, borderWidth, motion, isRtl } = useTheme();
  const reducedMotion = useReducedMotion();
  const chevron = accordionChevron(expanded);

  return (
    <PressableSurface
      feedback="background"
      onPress={onToggle}
      disabled={disabled}
      testID={testID}
      {...accordionA11y({ title, subtitle, trailingLabel, expanded, disabled })}
      pressedStyle={{ backgroundColor: colors.bg, borderColor: colors.borderStrong }}
      style={[
        {
          minHeight: sizes.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: borderWidth.thin,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
        },
        style,
      ]}>
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
        <Icon icon={icon} color={disabled ? colors.iconInactive : colors.primary} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle !== undefined && (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {/* Un seul chevron « vers le bas » qui tourne : pas besoin du miroir de `Icon` en arabe. */}
      <Animated.View
        style={{
          transform: [{ rotate: chevronRotation(chevron, isRtl) }],
          transitionProperty: 'transform',
          transitionDuration: reducedMotion ? 0 : motion.duration.normal,
          transitionTimingFunction: cssEaseOut,
        }}>
        <Icon icon={ChevronDown} color={colors.iconInactive} />
      </Animated.View>
    </PressableSurface>
  );
}

export type AccordionContentProps = {
  children: ReactNode;
  /** Espace sous le contenu (ex. entre deux lignes d'une liste) : `layout.listGap` par défaut. */
  gap?: boolean;
  /** Ligne qui suit une autre ligne du même contenu : pas d'espace au-dessus, le filet continue. */
  continued?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Contenu d'une section : décalé du début et bordé d'un filet à gauche (à droite en arabe).
 * Peut entourer chaque ligne d'une liste virtualisée : le filet reste continu.
 */
export function AccordionContent({ children, gap = false, continued = false, style }: AccordionContentProps) {
  const { colors, spacing, layout, borderWidth } = useTheme();
  return (
    <View
      style={[
        {
          marginStart: spacing.lg,
          paddingStart: spacing.md,
          borderStartWidth: borderWidth.thin,
          borderStartColor: colors.borderStrong,
          paddingTop: continued ? undefined : spacing.md,
          paddingBottom: gap ? layout.listGap : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Zone qui s'ouvre et se ferme en animant sa hauteur (mesurée une fois, puis multipliée par
 * l'avancement de l'animation) avec un fondu du contenu. Le contenu n'est monté que tant que la zone
 * est ouverte ou en train de se fermer. La hauteur est la seule propriété de mise en page animée de
 * l'appli : c'est voulu (le contenu qui suit descend en douceur), et le contenu d'une section reste
 * court. « Réduire les animations » activé : ouverture et fermeture immédiates.
 */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const { motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const initiallyOpen = useRef(open);
  const [mounted, setMounted] = useState(open);
  const [measured, setMeasured] = useState(false);
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.set(reducedMotion ? 1 : withTiming(1, { duration: motion.duration.normal, easing: easeOut }));
      return;
    }
    if (reducedMotion) {
      progress.set(0);
      setMounted(false);
      return;
    }
    progress.set(
      withTiming(0, { duration: motion.duration.normal, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      }),
    );
  }, [open, reducedMotion, motion.duration.normal, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.get() * progress.get(),
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  // Ouverte dès le premier rendu : le contenu est affiché tel quel jusqu'à sa mesure. Sinon la zone
  // reste à 0 de haut tant que le contenu n'est pas mesuré, pour ne jamais clignoter ouverte.
  const inFlow = initiallyOpen.current && !measured;
  const onLayout = (event: LayoutChangeEvent) => {
    contentHeight.set(event.nativeEvent.layout.height);
    setMeasured(true);
  };

  return (
    <Animated.View style={[{ overflow: 'hidden' }, measured ? animatedStyle : inFlow ? null : { height: 0 }]}>
      <View onLayout={onLayout} style={inFlow ? undefined : { position: 'absolute', start: 0, end: 0, top: 0 }}>
        {children}
      </View>
    </Animated.View>
  );
}

export type AccordionProps = Omit<AccordionHeaderProps, 'expanded' | 'onToggle'> & {
  expanded: boolean;
  onToggle: () => void;
  /** Affiché seulement quand la section est ouverte. */
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Section repliable : l'en-tête, puis le contenu tant que la section est ouverte (hauteur animée). */
export function Accordion({ children, contentStyle, ...header }: AccordionProps) {
  return (
    <View>
      <AccordionHeader {...header} />
      {children !== undefined && (
        <Collapsible open={header.expanded}>
          <AccordionContent style={contentStyle}>{children}</AccordionContent>
        </Collapsible>
      )}
    </View>
  );
}
