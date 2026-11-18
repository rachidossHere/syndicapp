import { describe, expect, it } from 'vitest';

import { opacity, sizes } from '../tokens/sizes';
import { pathPoints, zelligeGeometry } from './zellige-geometry';
import patternSource from './zellige-pattern.tsx?raw';

describe('motif zellige : géométrie', () => {
  const geometry = zelligeGeometry(sizes.zelligeCell);

  it('deux carrés (l’un tourné de 45°) forment l’étoile à huit branches, fermés', () => {
    for (const path of [geometry.square, geometry.diamond]) {
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
      expect(pathPoints(path)).toHaveLength(4);
    }
  });

  it('tout le dessin reste dans la cellule (le motif se répète sans déborder)', () => {
    for (const [x, y] of [...pathPoints(geometry.square), ...pathPoints(geometry.diamond)]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(geometry.cell);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(geometry.cell);
    }
  });

  it('symétrique (rotation de 90°, miroir horizontal) : identique en français et en arabe', () => {
    const c = geometry.cell / 2;
    const key = ([x, y]: [number, number]) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
    for (const path of [geometry.square, geometry.diamond]) {
      const points = pathPoints(path);
      const original = new Set(points.map(key));
      const mirrored = new Set(points.map(([x, y]) => key([2 * c - x, y])));
      const rotated = new Set(points.map(([x, y]) => key([c - (y - c), c + (x - c)])));
      expect(mirrored).toEqual(original);
      expect(rotated).toEqual(original);
    }
  });

  it('un petit cercle à chaque coin, qui rejoint ceux des cellules voisines', () => {
    expect(geometry.corners).toHaveLength(4);
    const corners = geometry.corners.map((corner) => `${corner.cx},${corner.cy}`).sort();
    const cell = geometry.cell;
    expect(corners).toEqual([`0,0`, `0,${cell}`, `${cell},0`, `${cell},${cell}`].sort());
  });

  it('suit la taille de cellule demandée', () => {
    expect(zelligeGeometry(80).cell).toBe(80);
    expect(Math.max(...pathPoints(zelligeGeometry(80).diamond).flat())).toBeGreaterThan(60);
  });
});

describe('ZelligePattern : rendu', () => {
  it('SVG répété par un Pattern, rempli par un Rect : un seul dessin pour toute la surface', () => {
    expect(patternSource).toContain('<Pattern');
    expect(patternSource).toContain('patternUnits="userSpaceOnUse"');
    expect(patternSource).toContain('<Rect width="100%" height="100%" fill={`url(#${patternId})`}');
    expect(patternSource).toContain('<Circle');
  });

  it('opacité de 10 % par défaut (jeton), couleur et taille réglables', () => {
    expect(opacity.zellige).toBe(0.1);
    expect(patternSource).toContain('opacity ?? theme.opacity.zellige');
    expect(patternSource).toContain('color ?? theme.colors.primary');
    expect(patternSource).toContain('cellSize ?? theme.sizes.zelligeCell');
  });

  it('décoratif, sans toucher, et sans coût au défilement (mis en bitmap)', () => {
    expect(patternSource).toContain('pointerEvents="none"');
    expect(patternSource).toContain('accessibilityElementsHidden');
    expect(patternSource).toContain('importantForAccessibility="no-hide-descendants"');
    expect(patternSource).toContain('shouldRasterizeIOS');
    expect(patternSource).toContain('renderToHardwareTextureAndroid');
    expect(patternSource).toContain('StyleSheet.absoluteFill');
  });

  it('identifiant de motif sûr (useId contient des « : » interdits dans url(#…))', () => {
    expect(patternSource).toContain(".replace(/[^a-zA-Z0-9]/g, '')");
  });

  it('aucune couleur ni côté codés en dur', () => {
    expect(patternSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(patternSource).not.toMatch(/\b(left|right)\b/);
  });
});
