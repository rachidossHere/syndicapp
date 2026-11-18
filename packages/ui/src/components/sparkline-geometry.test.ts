import { describe, expect, it } from 'vitest';

import { SPARKLINE_MIN_POINTS, sparklineGeometry } from './sparkline-geometry';

describe('sparklineGeometry', () => {
  it('ne trace rien avec moins de 3 valeurs', () => {
    expect(SPARKLINE_MIN_POINTS).toBe(3);
    expect(sparklineGeometry([], 80, 32, 2)).toBeNull();
    expect(sparklineGeometry([1, 2], 80, 32, 2)).toBeNull();
    expect(sparklineGeometry([1, Number.NaN, 3], 80, 32, 2)).toBeNull();
  });

  it('place la plus petite valeur en bas et la plus grande en haut, de gauche à droite', () => {
    const geometry = sparklineGeometry([0, 50, 100], 80, 32, 2);
    expect(geometry).not.toBeNull();
    const { points } = geometry!;
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 2, y: 30 });
    expect(points[1]).toEqual({ x: 40, y: 16 });
    expect(points[2]).toEqual({ x: 78, y: 2 });
  });

  it('trace une série constante à mi-hauteur', () => {
    const geometry = sparklineGeometry([5, 5, 5, 5], 80, 32, 2);
    expect(geometry!.points.every((point) => point.y === 16)).toBe(true);
  });

  it('ferme la zone sous la ligne', () => {
    const { area, line } = sparklineGeometry([1, 3, 2], 60, 20, 0)!;
    expect(area.startsWith('M0,20 L')).toBe(true);
    expect(area.endsWith('L60,20 Z')).toBe(true);
    expect(line.split(' ')).toHaveLength(3);
  });
});
