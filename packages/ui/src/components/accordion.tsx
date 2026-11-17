import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { accordionA11y, accordionChevron } from './accordion-state';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

export type AccordionHeaderProps = {
  /** Icône à gauche (début de ligne en français, fin en arabe), dans un carré `primarySoft`. */
  icon: IconComponent;
  title: string;
  subtitle?: string;
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
 * `SectionList` ; avec `Accordion`, il est suivi de son contenu.
 */
export function AccordionHeader({
  icon,
  title,
  subtitle,
  expanded,
  onToggle,
  disabled = false,
  style,
  testID,
}: AccordionHeaderProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const chevron = accordionChevron(expanded);

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      testID={testID}
      {...accordionA11y({ title, subtitle, expanded, disabled })}
      style={({ pressed }) => [
        {
          minHeight: sizes.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: pressed ? colors.bg : colors.surface,
          borderColor: pressed ? colors.borderStrong : colors.border,
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
      <Icon
        icon={chevron === 'down' ? ChevronDown : ChevronRight}
        color={colors.iconInactive}
        flipInRtl={chevron === 'forward'}
      />
    </Pressable>
  );
}

export type AccordionContentProps = {
  children: ReactNode;
  /** Espace sous le contenu (ex. entre deux lignes d'une liste) : `layout.listGap` par défaut. */
  gap?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Contenu d'une section : décalé du début et bordé d'un filet à gauche (à droite en arabe).
 * Peut entourer chaque ligne d'une liste virtualisée : le filet reste continu.
 */
export function AccordionContent({ children, gap = false, style }: AccordionContentProps) {
  const { colors, spacing, layout, borderWidth } = useTheme();
  return (
    <View
      style={[
        {
          marginStart: spacing.lg,
          paddingStart: spacing.md,
          borderStartWidth: borderWidth.thin,
          borderStartColor: colors.borderStrong,
          paddingTop: spacing.md,
          paddingBottom: gap ? layout.listGap : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export type AccordionProps = Omit<AccordionHeaderProps, 'expanded' | 'onToggle'> & {
  expanded: boolean;
  onToggle: () => void;
  /** Affiché seulement quand la section est ouverte. */
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Section repliable : l'en-tête, puis le contenu tant que la section est ouverte. */
export function Accordion({ children, contentStyle, ...header }: AccordionProps) {
  return (
    <View>
      <AccordionHeader {...header} />
      {header.expanded && children !== undefined && <AccordionContent style={contentStyle}>{children}</AccordionContent>}
    </View>
  );
}
