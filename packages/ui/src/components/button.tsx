import type { LucideIcon } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Theme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  /** Texte du bouton, aussi lu par les lecteurs d'écran. */
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  /**
   * `primary` : action principale. `accent` : une seule action clé par écran.
   * `secondary` : action alternative. `ghost` : action discrète. Par défaut : `primary`.
   */
  variant?: ButtonVariant;
  /** Hauteur 48 (`md`, par défaut) ou 52 (`lg`). */
  size?: ButtonSize;
  disabled?: boolean;
  /** Affiche un indicateur et désactive le bouton ; le libellé reste visible et annoncé. */
  loading?: boolean;
  /** Icône lucide affichée au début du bouton. */
  icon?: LucideIcon;
  /** Remplace le libellé lu par les lecteurs d'écran (par défaut : `label`). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Mise en page uniquement (marges, flex) : jamais les couleurs. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type VariantColors = { background: string; pressed: string; foreground: string; border?: string };

function variantColors(variant: ButtonVariant, colors: Theme['colors']): VariantColors {
  switch (variant) {
    case 'primary':
      return { background: colors.primary, pressed: colors.primaryPressed, foreground: colors.textInverse };
    case 'accent':
      // Pas de jeton « accent appuyé » : l'appui passe par l'opacité (voir plus bas).
      return { background: colors.accent, pressed: colors.accent, foreground: colors.text };
    case 'secondary':
      return {
        background: colors.surface,
        pressed: colors.bg,
        foreground: colors.text,
        border: colors.borderStrong,
      };
    case 'ghost':
      return { background: 'transparent', pressed: colors.primarySoft, foreground: colors.primary };
  }
}

/** Bouton du design system : 4 variantes, états appuyé, désactivé et chargement. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors, radius, spacing, sizes, borderWidth, opacity } = useTheme();
  const inactive = disabled || loading;
  const palette = variantColors(variant, colors);

  // Désactivé : fond primaryDisabled (variante ghost : texte atténué, sans fond).
  const foreground = disabled
    ? variant === 'ghost'
      ? colors.iconInactive
      : colors.textInverse
    : palette.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: sizes.button[size],
          paddingVertical: spacing.sm,
          paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: palette.background,
        },
        palette.border !== undefined && { borderWidth: borderWidth.thin, borderColor: palette.border },
        pressed && !inactive && { backgroundColor: palette.pressed },
        pressed && !inactive && variant === 'accent' && { opacity: opacity.pressed },
        disabled && variant !== 'ghost' && { backgroundColor: colors.primaryDisabled, borderWidth: 0 },
        style,
      ]}>
      {loading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ActivityIndicator color={foreground} />
        </View>
      ) : (
        icon !== undefined && <Icon icon={icon} color={foreground} />
      )}
      <Text variant="bodyStrong" style={{ color: foreground, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
