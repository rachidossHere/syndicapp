import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../theme/theme-provider';

export type { LucideIcon as IconComponent } from 'lucide-react-native';

export type IconProps = {
  /** Icône lucide, par exemple `Check` importée de lucide-react-native. */
  icon: LucideIcon;
  color: string;
  /** Taille en px. Par défaut : `sizes.icon` (20). */
  size?: number;
  /** Inverse l'icône en arabe (flèches, chevrons : icônes de direction). */
  flipInRtl?: boolean;
};

/**
 * Icône lucide décorative (trait de 2 px), masquée aux lecteurs d'écran :
 * le sens est toujours porté par un libellé à côté.
 */
export function Icon({ icon: LucideComponent, color, size, flipInRtl = false }: IconProps) {
  const { sizes, isRtl } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Miroir horizontal (échelle -1) pour les icônes de direction en arabe.
      style={flipInRtl && isRtl ? { transform: [{ scaleX: -1 }] } : undefined}>
      <LucideComponent size={size ?? sizes.icon} color={color} strokeWidth={sizes.iconStroke} />
    </View>
  );
}
