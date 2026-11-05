/** Rayons des coins en px (plan 02). `pill` donne une forme de gélule (badges). */
export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export type Radius = typeof radius;
export type RadiusToken = keyof Radius;
