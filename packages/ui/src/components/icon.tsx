import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import type { Domain } from '../tokens/domains';
import { resolveIcon, type IconTileSize, type IconVariant } from './icon-spec';

export type { LucideIcon as IconComponent } from 'lucide-react-native';
export type { IconTileSize, IconVariant } from './icon-spec';

export type IconProps = {
  /** Icône lucide, par exemple `Check` importée de lucide-react-native. */
  icon: LucideIcon;
  /** Couleur explicite. Sans couleur, celle du `domain` (ou `text`). */
  color?: string;
  /** Domaine (charges, dépenses…) : couleur d'icône et, en pastille, fond teinté. */
  domain?: Domain;
  /**
   * `line` (par défaut) : contour de 2 px. `duotone` : contour plus remplissage léger de la même
   * couleur. `tile` : duotone dans une pastille teintée de 40, 48 ou 56 px.
   */
  variant?: IconVariant;
  /** Taille en px (variantes `line` et `duotone`). Par défaut : `sizes.icon` (20). */
  size?: number;
  /** Taille de la pastille de la variante `tile` : `sm` 40, `md` 48 (défaut), `lg` 56. */
  tileSize?: IconTileSize;
  /** Inverse l'icône en arabe (flèches, chevrons : icônes de direction). */
  flipInRtl?: boolean;
  /**
   * Libellé lu par les lecteurs d'écran. Sans libellé (par défaut), l'icône est décorative et
   * masquée : le sens est alors toujours porté par un texte à côté.
   */
  label?: string;
};

/**
 * Icône lucide de l'appli : SEUL moyen d'afficher une icône (AGENTS.md). Décorative par défaut ;
 * avec `label`, elle est annoncée comme une image.
 */
export function Icon({
  icon: LucideComponent,
  color,
  domain,
  variant,
  size,
  tileSize,
  flipInRtl = false,
  label,
}: IconProps) {
  const { colors, domainColors, sizes, opacity, radius, isRtl } = useTheme();
  const spec = resolveIcon(
    { variant, color, domain, size, tileSize, label },
    {
      defaultColor: colors.text,
      defaultTileBg: colors.primarySoft,
      domainColors,
      sizes,
      duotoneFill: opacity.duotoneFill,
    },
  );

  const glyph = (
    <LucideComponent
      size={spec.size}
      color={spec.color}
      strokeWidth={sizes.iconStroke}
      // Duotone : lucide dessine en `fill="none"` ; un remplissage de la même couleur, léger, suffit.
      {...(spec.fillOpacity > 0 ? { fill: spec.color, fillOpacity: spec.fillOpacity } : {})}
    />
  );

  const a11y = spec.accessibility.decorative
    ? ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const)
    : ({
        accessible: true,
        accessibilityRole: spec.accessibility.role,
        accessibilityLabel: spec.accessibility.label,
      } as const);

  return (
    <View
      {...a11y}
      style={[
        // Miroir horizontal (échelle -1) pour les icônes de direction en arabe.
        flipInRtl && isRtl ? { transform: [{ scaleX: -1 }] } : undefined,
        spec.tile
          ? {
              width: spec.tile.side,
              height: spec.tile.side,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: spec.tile.background,
              alignItems: 'center',
              justifyContent: 'center',
            }
          : undefined,
      ]}
    >
      {glyph}
    </View>
  );
}
