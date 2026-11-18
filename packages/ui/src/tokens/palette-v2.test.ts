import { describe, expect, it } from 'vitest';

import { colors } from './colors';
import { DOMAINS, domainColors } from './domains';
import { motion } from './motion';
import { opacity, sizes } from './sizes';

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('palette élargie (plan 02b)', () => {
  it('valeurs de la maquette docs/design-v2.png', () => {
    expect(colors.tealDeep).toBe('#0A3A3E');
    expect(colors.terracotta).toBe('#C2603A');
    expect(colors.saffron).toBe('#E0A33B');
    expect(colors.palm).toBe('#2F7A5F');
  });

  it('les couleurs d’origine du plan 02 n’ont pas bougé', () => {
    expect(colors.primary).toBe('#0F5257');
    expect(colors.accent).toBe('#F2B33D');
    expect(colors.bg).toBe('#F6F2EA');
    expect(colors.dangerFg).toBe('#8E3512');
  });

  it.each([
    ['textInverse', 'tealDeep'],
    ['textInverse', 'palm'],
    ['text', 'saffron'],
    ['tealDeep', 'bg'],
    ['tealDeep', 'surface'],
    ['palm', 'surface'],
  ] as const)('texte %s sur %s : au moins 4,5:1', (foreground, background) => {
    expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
  });

  it('terracotta : jamais de texte courant (4,5:1 impossible), mais 3:1 pour le décor et les grands textes', () => {
    expect(contrast(colors.textInverse, colors.terracotta)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.terracotta, colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.textInverse, colors.terracotta)).toBeLessThan(4.5);
  });
});

describe('teintes par domaine', () => {
  it('les huit domaines de la maquette existent', () => {
    expect([...DOMAINS].sort()).toEqual(
      ['accounts', 'announcements', 'charges', 'expenses', 'issues', 'members', 'notifications', 'residence'].sort(),
    );
    expect(Object.keys(domainColors).sort()).toEqual([...DOMAINS].sort());
  });

  it.each(DOMAINS)('%s : icône et texte sur le fond teinté, au moins 4,5:1', (domain) => {
    const { bg, fg } = domainColors[domain];
    expect(bg).toMatch(/^#[0-9A-F]{6}$/);
    expect(fg).toMatch(/^#[0-9A-F]{6}$/);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(DOMAINS)('%s : le fond teinté se distingue du fond des écrans et reste clair', (domain) => {
    const { bg } = domainColors[domain];
    expect(bg.toLowerCase()).not.toBe(colors.bg.toLowerCase());
    expect(luminance(bg)).toBeGreaterThan(0.7);
  });
});

describe('jetons de mouvement', () => {
  it('durées : fast 150 ms, normal 250 ms, toutes sous 300 ms', () => {
    expect(motion.duration.fast).toBe(150);
    expect(motion.duration.normal).toBe(250);
    for (const value of Object.values(motion.duration)) expect(value).toBeLessThan(300);
  });

  it('courbes : des Bézier valides, jamais d’ease-in (départ lent)', () => {
    for (const [name, curve] of Object.entries(motion.easing)) {
      expect(curve, name).toHaveLength(4);
      const [x1, , x2] = curve;
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
      // Un ease-in a ses deux points de contrôle sous la diagonale (y < x) : interdit.
      expect(curve[1] >= curve[0] || curve[3] >= curve[2], `${name} ressemble à un ease-in`).toBe(true);
    }
  });

  it('échelle d’appui légère (entre 0,9 et 1)', () => {
    expect(motion.pressScale).toBeGreaterThan(0.9);
    expect(motion.pressScale).toBeLessThan(1);
  });
});

describe('dimensions et opacités des nouveaux composants', () => {
  it('pastille de 40 à 56 px, icône à la moitié', () => {
    expect(sizes.iconTile).toEqual({ sm: 40, md: 48, lg: 56 });
    for (const key of ['sm', 'md', 'lg'] as const) {
      expect(sizes.iconTileGlyph[key] * 2).toBe(sizes.iconTile[key]);
      expect(sizes.iconTile[key]).toBeGreaterThanOrEqual(sizes.touchTarget - 4);
    }
  });

  it('zellige à 10 % d’opacité, remplissage duotone léger', () => {
    expect(opacity.zellige).toBe(0.1);
    expect(opacity.duotoneFill).toBeGreaterThan(0);
    expect(opacity.duotoneFill).toBeLessThanOrEqual(0.3);
  });
});
