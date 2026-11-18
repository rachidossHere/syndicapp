import { describe, expect, it } from 'vitest';

import layoutSource from '../../app/_layout.tsx?raw';
import routeSource from '../../app/dev/design-v2.tsx?raw';
import { ar } from '../../i18n/ar';
import { fr } from '../../i18n/fr';
import homeSource from '../home/home-screen.tsx?raw';
import profileSource from '../profile/profile-screen.tsx?raw';
import { designV2Copy } from './design-v2-copy';
import screenSource from './design-v2-screen.tsx?raw';

describe('galerie de développement (plan 02b)', () => {
  it('la route est déclarée sous le garde __DEV__, donc inaccessible hors développement (liens profonds compris)', () => {
    const guarded = layoutSource.match(
      /<Stack\.Protected guard=\{__DEV__\}>([\s\S]*?)<\/Stack\.Protected>/,
    );
    expect(guarded).not.toBeNull();
    expect(guarded![1]).toContain('name="dev/design-v2"');
    // Jamais déclarée en dehors de ce garde.
    expect(layoutSource.match(/dev\/design-v2/g)).toHaveLength(1);
    expect(routeSource).toContain("from '@/features/dev/design-v2-screen'");
  });

  it('le lien depuis le Profil n’existe que sous __DEV__ (plus sur l’accueil)', () => {
    // Le Profil construit ses lignes avec `isDev: __DEV__` ; la galerie n'y figure que si `has('gallery')`.
    expect(profileSource).toContain('isDev: __DEV__');
    const link = profileSource.match(/\{has\('gallery'\) && \(\s*<ListItem[\s\S]{0,200}?\/dev\/design-v2/);
    expect(link, 'ligne de la galerie sous has(gallery)').not.toBeNull();
    expect(profileSource.match(/\/dev\/design-v2/g)).toHaveLength(1);
    expect(homeSource).not.toContain('/dev/design-v2');
  });

  it('le titre de l’écran est traduit en français et en arabe', () => {
    expect(fr['dev.gallery']).toBeTruthy();
    expect(ar['dev.gallery']).toMatch(/[؀-ۿ]/);
  });
});

describe('galerie : contenu', () => {
  it('montre les nouvelles couleurs, les huit icônes en pastille, le motif zellige et PressableScale', () => {
    for (const token of ['tealDeep', 'terracotta', 'saffron', 'palm'])
      expect(screenSource).toContain(`'${token}'`);
    expect(screenSource).toContain('DOMAINS.map');
    expect(screenSource).toContain('variant="tile"');
    expect(screenSource.match(/\{ icon: \w+, domain: '\w+', label: '\w+' \}/g)).toHaveLength(8);
    expect(screenSource).toContain('<ZelligePattern');
    expect(screenSource).toContain('<PressableScale');
    expect(screenSource).toContain('useReducedMotion()');
  });

  it('les huit icônes de la maquette couvrent des domaines existants', () => {
    const domains = [...screenSource.matchAll(/domain: '(\w+)', label/g)].map((m) => m[1]);
    expect(new Set(domains).size).toBe(8);
    expect([...domains].sort()).toEqual([
      'accounts',
      'announcements',
      'charges',
      'expenses',
      'issues',
      'members',
      'notifications',
      'residence',
    ]);
  });

  it('textes en français et en arabe, mêmes clés, arabe en lettres arabes', () => {
    expect(Object.keys(designV2Copy.ar).sort()).toEqual(Object.keys(designV2Copy.fr).sort());
    const latinOnly = new Set(['sizeSm', 'sizeMd', 'sizeLg', 'pressable']);
    for (const [key, value] of Object.entries(designV2Copy.ar)) {
      if (!latinOnly.has(key)) expect(value, key).toMatch(/[؀-ۿ]/);
    }
  });

  it('aucune couleur, taille de police, rayon ni côté codés en dur (jetons de @syndic/ui seulement)', () => {
    for (const source of [screenSource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(
        /fontSize|borderRadius: \d|\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight)\b/,
      );
    }
  });

  it('les icônes passent par le composant Icon (aucun import direct de lucide hors du composant)', () => {
    expect(screenSource).not.toMatch(
      /<(Building|Wallet|ChartColumn|ReceiptText|Flag|Megaphone|Users|Bell)\s/,
    );
  });
});
