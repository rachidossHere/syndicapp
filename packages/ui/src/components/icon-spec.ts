// Choix des valeurs d'une icône (plan 02b) : fonction pure, sans React ni react-native, testée avec
// vitest. Le composant `Icon` n'a plus qu'à afficher ce qu'elle renvoie.
import type { Domain, DomainColors } from '../tokens/domains';

export type IconVariant = 'line' | 'duotone' | 'tile';
export type IconTileSize = 'sm' | 'md' | 'lg';

export type IconSpecInput = {
  /** `line` : contour seul (plan 02). `duotone` : contour plus remplissage léger. `tile` : duotone dans une pastille teintée. */
  variant?: IconVariant;
  /** Couleur explicite (prioritaire sur le domaine). */
  color?: string;
  /** Domaine : fournit la couleur d'icône et, en pastille, le fond teinté. */
  domain?: Domain;
  /** Taille de l'icône en px (hors pastille). */
  size?: number;
  /** Taille de la pastille (variante `tile`). */
  tileSize?: IconTileSize;
  /** Libellé lu par les lecteurs d'écran. Sans libellé, l'icône est décorative. */
  label?: string;
};

export type IconSpecTokens = {
  /** Couleur par défaut quand ni couleur ni domaine ne sont donnés. */
  defaultColor: string;
  /** Fond de pastille par défaut (sans domaine). */
  defaultTileBg: string;
  domainColors: Record<Domain, DomainColors>;
  sizes: {
    icon: number;
    iconTile: Record<IconTileSize, number>;
    iconTileGlyph: Record<IconTileSize, number>;
  };
  duotoneFill: number;
};

export type IconSpec = {
  variant: IconVariant;
  /** Couleur du contour (et du remplissage duotone). */
  color: string;
  /** Taille de l'icône en px. */
  size: number;
  /** Opacité du remplissage : 0 (aucun) pour `line`. */
  fillOpacity: number;
  /** Pastille : fond et côté ; `null` hors variante `tile`. */
  tile: { background: string; side: number } | null;
  /** Accessibilité : décoratif (masqué) ou image avec libellé. */
  accessibility: { decorative: true } | { decorative: false; role: 'image'; label: string };
};

/** Valeurs finales d'une icône à partir de ses propriétés et des jetons. */
export function resolveIcon(input: IconSpecInput, tokens: IconSpecTokens): IconSpec {
  const variant = input.variant ?? 'line';
  const domain = input.domain ? tokens.domainColors[input.domain] : undefined;
  const color = input.color ?? domain?.fg ?? tokens.defaultColor;
  const tileSize = input.tileSize ?? 'md';
  const label = input.label?.trim();

  return {
    variant,
    color,
    size:
      variant === 'tile' ? tokens.sizes.iconTileGlyph[tileSize] : (input.size ?? tokens.sizes.icon),
    fillOpacity: variant === 'line' ? 0 : tokens.duotoneFill,
    tile:
      variant === 'tile'
        ? { background: domain?.bg ?? tokens.defaultTileBg, side: tokens.sizes.iconTile[tileSize] }
        : null,
    accessibility: label ? { decorative: false, role: 'image', label } : { decorative: true },
  };
}
