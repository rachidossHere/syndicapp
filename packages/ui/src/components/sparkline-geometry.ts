// Géométrie de la petite courbe du solde (écran 1 de docs/design-v2.png). Fonction pure, sans React :
// testée avec vitest.

/** Nombre minimal de points pour qu'une courbe ait un sens. */
export const SPARKLINE_MIN_POINTS = 3;

export type SparklineGeometry = {
  /** Points de la ligne, de gauche à droite (dans le repère de dessin, toujours de gauche à droite). */
  points: { x: number; y: number }[];
  /** Chaîne `x,y x,y …` pour une `Polyline`. */
  line: string;
  /** Chemin fermé sous la ligne, pour le remplissage léger. */
  area: string;
};

/**
 * Courbe de `values` (de la plus ancienne à la plus récente) dans un cadre `width` × `height`, avec
 * une marge de `padding`. Renvoie `null` s'il y a moins de `SPARKLINE_MIN_POINTS` valeurs finies.
 * Une série constante est tracée à mi-hauteur.
 */
export function sparklineGeometry(
  values: readonly number[],
  width: number,
  height: number,
  padding: number,
): SparklineGeometry | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < SPARKLINE_MIN_POINTS) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const innerW = Math.max(width - 2 * padding, 0);
  const innerH = Math.max(height - 2 * padding, 0);
  const points = finite.map((value, index) => ({
    x: padding + (innerW * index) / (finite.length - 1),
    y: max === min ? height / 2 : padding + innerH * (1 - (value - min) / (max - min)),
  }));
  const round = (n: number) => Math.round(n * 100) / 100;
  const line = points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `M${round(first.x)},${height} L${points.map((p) => `${round(p.x)},${round(p.y)}`).join(' L')} L${round(last.x)},${height} Z`;
  return { points, line, area };
}
