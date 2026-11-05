import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import type { ColorToken } from '../tokens/colors';
import { ARABIC_LINE_HEIGHT_FACTOR, type TypographyToken } from '../tokens/typography';

export type TextVariant = TypographyToken;

export type TextTone =
  | 'default'
  | 'muted'
  | 'inverse'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary';

const toneColors = {
  default: 'text',
  muted: 'textMuted',
  inverse: 'textInverse',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
  info: 'infoFg',
  primary: 'primary',
} as const satisfies Record<TextTone, ColorToken>;

const headerVariants: ReadonlySet<TextVariant> = new Set(['display', 'h1', 'h2', 'h3']);

export type TextProps = RNTextProps & {
  /** Style typographique (jetons de typographie). Par défaut : `body`. */
  variant?: TextVariant;
  /** Couleur du texte selon son rôle. Par défaut : `default`. */
  tone?: TextTone;
};

/**
 * Texte du design system : taille, interligne et couleur viennent des jetons,
 * la police est choisie selon la langue active et la graisse du style.
 * En arabe, l'interligne est augmenté d'environ 15 %.
 * Les titres (display, h1, h2, h3) sont annoncés comme en-têtes aux lecteurs d'écran.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  accessibilityRole,
  style,
  ...props
}: TextProps) {
  const { colors, typography, fontFamily, isRtl } = useTheme();
  const token = typography[variant];
  const lineHeight = isRtl ? Math.round(token.lineHeight * ARABIC_LINE_HEIGHT_FACTOR) : token.lineHeight;

  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (headerVariants.has(variant) ? 'header' : undefined)}
      style={[
        {
          color: colors[toneColors[tone]],
          fontSize: token.fontSize,
          lineHeight,
          // Une police par graisse : la graisse passe par fontFamily, jamais par fontWeight.
          fontFamily: fontFamily(token.fontWeight),
          // Alignement au début de la ligne : à gauche en français, à droite en arabe.
          textAlign: 'auto',
          writingDirection: isRtl ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...props}
    />
  );
}
