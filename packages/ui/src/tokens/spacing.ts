/** Espacements en px, base 4 (plan 02). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type Spacing = typeof spacing;
export type SpacingToken = keyof Spacing;

/** Espacements de mise en page des écrans mobiles (plan 02). */
export const layout = {
  /** Marge latérale des écrans (en `paddingHorizontal`, jamais left/right). */
  screenPadding: spacing.xl,
  /** Espace entre les cartes d'une liste. */
  listGap: spacing.md,
  /** Espace entre les sections. */
  sectionGap: spacing.lg,
} as const;

export type LayoutToken = keyof typeof layout;
