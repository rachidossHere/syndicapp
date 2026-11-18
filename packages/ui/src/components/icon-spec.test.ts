import { describe, expect, it } from 'vitest';

import { colors } from '../tokens/colors';
import { DOMAINS, domainColors } from '../tokens/domains';
import { opacity, sizes } from '../tokens/sizes';
import iconSource from './icon.tsx?raw';
import { resolveIcon, type IconSpecTokens } from './icon-spec';

const tokens: IconSpecTokens = {
  defaultColor: colors.text,
  defaultTileBg: colors.primarySoft,
  domainColors,
  sizes,
  duotoneFill: opacity.duotoneFill,
};

describe('Icon : variantes', () => {
  it('line (défaut) : le contour du plan 02, sans remplissage ni pastille, taille 20', () => {
    const spec = resolveIcon({ color: colors.primary }, tokens);
    expect(spec).toMatchObject({
      variant: 'line',
      color: colors.primary,
      size: sizes.icon,
      fillOpacity: 0,
      tile: null,
    });
  });

  it('duotone : même couleur pour le contour et un remplissage léger', () => {
    const spec = resolveIcon({ variant: 'duotone', color: colors.palm, size: 22 }, tokens);
    expect(spec).toMatchObject({
      variant: 'duotone',
      color: colors.palm,
      size: 22,
      fillOpacity: opacity.duotoneFill,
      tile: null,
    });
  });

  it.each(['sm', 'md', 'lg'] as const)(
    'tile %s : pastille teintée, icône à la moitié',
    (tileSize) => {
      const spec = resolveIcon({ variant: 'tile', domain: 'charges', tileSize }, tokens);
      expect(spec.tile).toEqual({
        background: domainColors.charges.bg,
        side: sizes.iconTile[tileSize],
      });
      expect(spec.size).toBe(sizes.iconTileGlyph[tileSize]);
      expect(spec.fillOpacity).toBe(opacity.duotoneFill);
      expect(spec.tile!.side).toBeGreaterThanOrEqual(40);
      expect(spec.tile!.side).toBeLessThanOrEqual(56);
    },
  );

  it('tile : 48 px par défaut', () => {
    expect(resolveIcon({ variant: 'tile', domain: 'issues' }, tokens).tile?.side).toBe(48);
  });

  it.each(DOMAINS)('domaine %s : couleur d’icône et fond de la teinte du domaine', (domain) => {
    const spec = resolveIcon({ variant: 'tile', domain }, tokens);
    expect(spec.color).toBe(domainColors[domain].fg);
    expect(spec.tile?.background).toBe(domainColors[domain].bg);
  });

  it('une couleur explicite l’emporte sur celle du domaine, le fond reste celui du domaine', () => {
    const spec = resolveIcon(
      { variant: 'tile', domain: 'accounts', color: colors.primary },
      tokens,
    );
    expect(spec.color).toBe(colors.primary);
    expect(spec.tile?.background).toBe(domainColors.accounts.bg);
  });

  it('sans couleur ni domaine : texte par défaut, pastille primarySoft', () => {
    expect(resolveIcon({}, tokens).color).toBe(colors.text);
    expect(resolveIcon({ variant: 'tile' }, tokens).tile?.background).toBe(colors.primarySoft);
  });
});

describe('Icon : accessibilité', () => {
  it('décorative par défaut (aucun libellé)', () => {
    expect(resolveIcon({ domain: 'charges' }, tokens).accessibility).toEqual({ decorative: true });
    expect(resolveIcon({ label: '   ' }, tokens).accessibility).toEqual({ decorative: true });
  });

  it('avec un libellé : image annoncée avec ce libellé', () => {
    expect(resolveIcon({ label: 'Charges' }, tokens).accessibility).toEqual({
      decorative: false,
      role: 'image',
      label: 'Charges',
    });
  });

  it('le composant masque l’icône décorative aux lecteurs d’écran et annonce l’icône libellée', () => {
    expect(iconSource).toContain('accessibilityElementsHidden: true');
    expect(iconSource).toContain("importantForAccessibility: 'no-hide-descendants'");
    expect(iconSource).toContain('accessibilityLabel: spec.accessibility.label');
  });
});

describe('Icon : composant', () => {
  it('le duotone passe par fill + fillOpacity de lucide ; le trait reste celui des jetons', () => {
    expect(iconSource).toContain('fillOpacity: spec.fillOpacity');
    expect(iconSource).toContain('strokeWidth={sizes.iconStroke}');
  });

  it('les icônes de direction sont inversées en RTL', () => {
    expect(iconSource).toMatch(/flipInRtl && isRtl\s*\? \{ transform: \[\{ scaleX: -1 \}\] \}/);
  });

  it('aucune couleur ni côté codés en dur dans le composant', () => {
    expect(iconSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(iconSource).not.toMatch(/\b(left|right|marginLeft|marginRight)\b/);
  });
});
