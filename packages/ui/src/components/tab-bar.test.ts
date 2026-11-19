import { describe, expect, it } from 'vitest';

import avatarSource from './avatar.tsx?raw';
import skeletonSource from './skeleton.tsx?raw';
import tabBarSource from './tab-bar.tsx?raw';

describe('TabBar (plan 02b : cinq onglets)', () => {
  it('accepte cinq onglets', () => {
    expect(tabBarSource).toContain('TAB_BAR_MAX_ITEMS = 5');
  });

  it('l’onglet actif est en duotone et garde son libellé : jamais la couleur seule', () => {
    expect(tabBarSource).toContain("variant={active ? 'duotone' : 'line'}");
    expect(tabBarSource).toContain('{item.label}');
    expect(tabBarSource).toContain('accessibilityState={{ selected: active }}');
  });

  it('aucune animation au changement d’onglet', () => {
    expect(tabBarSource).not.toMatch(/Animated|withTiming|withSpring|transition/);
  });

  it('zone tactile d’au moins 44 px par le jeton, jamais une valeur en dur', () => {
    expect(tabBarSource).toContain('minHeight: sizes.touchTarget');
  });
});

describe('Skeleton', () => {
  it('est un bloc simple, masqué aux lecteurs d’écran et sans animation', () => {
    expect(skeletonSource).toContain('accessibilityElementsHidden');
    expect(skeletonSource).not.toMatch(/Animated|withTiming|withRepeat|transition/);
    expect(skeletonSource).toContain('colors.border');
  });
});

describe('Avatar', () => {
  it('peut n’afficher que l’initiale (accueils de la maquette v2)', () => {
    expect(avatarSource).toContain('single');
    expect(avatarSource).toContain('getInitial(name)');
  });
});
