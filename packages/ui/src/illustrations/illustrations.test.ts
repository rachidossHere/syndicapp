import { ANNOUNCEMENT_CATEGORIES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import emptyStateSource from '../components/empty-state.tsx?raw';
import residenceHeroSource from '../components/residence-hero.tsx?raw';
import { colors } from '../tokens/colors';
import { opacity, sizes } from '../tokens/sizes';
import categoryArtSource from './category-art.tsx?raw';
import { CATEGORY_ART, CATEGORY_ART_CATEGORIES } from './category-art-spec';
import { EMPTY_DOMAINS, EMPTY_ILLUSTRATION_NAMES, emptyIllustrationName } from './empty-domain';
import emptyIllustrationsSource from './empty-illustrations.tsx?raw';
import gradientSource from './gradient-fill.tsx?raw';
import frameSource from './illustration-frame.tsx?raw';
import residenceSource from './residence-illustration.tsx?raw';
import { archPath, frondPath, palmCrown, sparklePath } from './shapes';
import welcomeSceneSource from './welcome-scene.tsx?raw';

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('formes des illustrations', () => {
  it('une arcade est fermée, droite en bas et arrondie en haut', () => {
    const d = archPath(10, 20, 14, 20);
    expect(d.startsWith('M10 40')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('A7 7 0 0 1 24 27');
  });

  it('une feuille part de son point d’attache et finit à la longueur demandée', () => {
    const d = frondPath(50, 50, -90, 20, 6);
    expect(d.startsWith('M50 50')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const [, , , , tipX, tipY] = numbers(d);
    expect(tipX).toBeCloseTo(50, 0);
    expect(tipY).toBeCloseTo(30, 0);
  });

  it('un éventail compte une feuille par angle, toutes différentes', () => {
    const crown = palmCrown(10, 10, [-150, -90, -30], 20, 5);
    expect(crown).toHaveLength(3);
    expect(new Set(crown).size).toBe(3);
  });

  it('l’éclat est fermé et centré sur son point', () => {
    const d = sparklePath(50, 50, 10);
    expect(d.endsWith('Z')).toBe(true);
    expect(numbers(d)).toContain(40);
    expect(numbers(d)).toContain(60);
  });
});

describe('illustrations décoratives', () => {
  it('le cadre commun est ignoré par VoiceOver et TalkBack et ne reçoit pas le toucher', () => {
    expect(frameSource).toContain('accessibilityElementsHidden');
    expect(frameSource).toContain('importantForAccessibility="no-hide-descendants"');
    expect(frameSource).toContain('pointerEvents="none"');
    expect(frameSource).toContain('accessible={false}');
  });

  it('la scène de bienvenue, le dégradé et l’illustration de catégorie sont masqués aussi', () => {
    for (const source of [welcomeSceneSource, gradientSource, categoryArtSource]) {
      expect(source).toContain('accessibilityElementsHidden');
      expect(source).toContain('importantForAccessibility="no-hide-descendants"');
      expect(source).toContain('pointerEvents="none"');
    }
  });

  it('la résidence et chaque illustration d’état vide passent par le cadre (donc masquées)', () => {
    expect(residenceSource).toContain('<IllustrationFrame');
    const frames = emptyIllustrationsSource.match(/<IllustrationFrame /g) ?? [];
    // Signalements, annonces, charges, dépenses et générique ; les appartements réutilisent la résidence.
    expect(frames).toHaveLength(5);
    expect(emptyIllustrationsSource).toContain('<ResidenceIllustration tone="light"');
  });

  it('uniquement les couleurs des jetons : aucune valeur hexadécimale ni rgb() dans les dessins', () => {
    for (const source of [
      residenceSource,
      emptyIllustrationsSource,
      categoryArtSource,
      welcomeSceneSource,
      gradientSource,
      residenceHeroSource,
    ]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
    }
  });

  it('rien n’est inversé en arabe, et aucune position left/right', () => {
    for (const source of [
      residenceSource,
      emptyIllustrationsSource,
      categoryArtSource,
      welcomeSceneSource,
      residenceHeroSource,
      emptyStateSource,
    ]) {
      expect(source).not.toMatch(/scaleX|flipInRtl|\bleft:|\bright:|isRtl/);
    }
  });

  it('légères : les chemins sont calculés au chargement du module, pas au rendu', () => {
    expect(residenceSource).toMatch(/^const WINDOWS = /m);
    expect(residenceSource).toMatch(/^const FRONDS = /m);
    expect(welcomeSceneSource).toMatch(/^const FRONDS = /m);
    expect(emptyIllustrationsSource).toMatch(/^const LEAVES = /m);
    expect(residenceSource).not.toMatch(/useEffect|useState|Animated/);
  });

  it('réutilisables à plusieurs tailles : `size` règle la largeur, les proportions sont gardées', () => {
    expect(frameSource).toContain('(w * height) / width');
    expect(frameSource).toContain('viewBox={`0 0 ${width} ${height}`}');
  });
});

describe('états vides illustrés par domaine', () => {
  it('six domaines, chacun avec son dessin distinct', () => {
    expect([...EMPTY_DOMAINS]).toEqual(['issues', 'announcements', 'charges', 'expenses', 'apartments', 'generic']);
    const names = EMPTY_DOMAINS.map(emptyIllustrationName);
    expect(new Set(names).size).toBe(EMPTY_DOMAINS.length);
    expect(Object.keys(EMPTY_ILLUSTRATION_NAMES).sort()).toEqual([...EMPTY_DOMAINS].sort());
    expect(emptyIllustrationName('issues')).toBe('clipboard');
  });

  it('EmptyIllustration choisit l’illustration selon le domaine', () => {
    const expected = {
      issues: 'IssuesIllustration',
      announcements: 'AnnouncementsIllustration',
      charges: 'ChargesIllustration',
      expenses: 'ExpensesIllustration',
      apartments: 'ApartmentsIllustration',
      generic: 'GenericIllustration',
    } as const;
    const source = emptyIllustrationsSource.replace(/\r\n/g, '\n');
    for (const domain of EMPTY_DOMAINS) {
      expect(source).toContain(`case '${domain}':\n      return <${expected[domain]} {...props} />;`);
      expect(source).toContain(`export function ${expected[domain]}(`);
    }
  });

  it('EmptyState affiche l’illustration du domaine sur un cercle à motif zellige, et garde l’icône sans domaine', () => {
    expect(emptyStateSource).toContain('domain?: EmptyDomain');
    expect(emptyStateSource).toContain('<EmptyIllustration domain={domain}');
    expect(emptyStateSource).toContain('<ZelligePattern />');
    expect(emptyStateSource).toContain('sizes.emptyCircle');
    expect(emptyStateSource).toContain('radius.pill');
    // Titre, texte et action restent.
    expect(emptyStateSource).toContain('{action}');
    expect(emptyStateSource).toContain('description !== undefined');
    expect(emptyStateSource).toContain('icon !== undefined');
  });

  it('le cercle est assez grand pour l’illustration', () => {
    expect(sizes.emptyCircle).toBeGreaterThan(sizes.emptyIllustration);
    expect(opacity.zellige).toBe(0.1);
  });
});

describe('illustrations de catégories d’annonces', () => {
  it('une illustration par catégorie de l’API, toutes différentes', () => {
    expect([...CATEGORY_ART_CATEGORIES].sort()).toEqual([...ANNOUNCEMENT_CATEGORIES].sort());
    const looks = CATEGORY_ART_CATEGORIES.map((c) => JSON.stringify(CATEGORY_ART[c]));
    expect(new Set(looks).size).toBe(4);
  });

  it('dégradés et pictogrammes : couleurs des jetons, tracés non vides', () => {
    for (const category of CATEGORY_ART_CATEGORIES) {
      const spec = CATEGORY_ART[category];
      expect(colors).toHaveProperty(spec.from);
      expect(colors).toHaveProperty(spec.to);
      expect(spec.paths.length).toBeGreaterThan(0);
      for (const path of spec.paths) expect(path.startsWith('M')).toBe(true);
    }
  });

  it('le pictogramme est blanc sur le dégradé et le composant remplit son parent', () => {
    expect(categoryArtSource).toContain('colors.textInverse');
    expect(categoryArtSource).toContain('StyleSheet.absoluteFill');
    expect(categoryArtSource).toContain('<GradientFill');
  });
});

describe('en-tête de résidence (ResidenceHero)', () => {
  it('dégradé tealDeep vers primary, motif zellige, illustration au bord `end`', () => {
    expect(residenceHeroSource).toContain('from={colors.tealDeep} to={colors.primary}');
    expect(residenceHeroSource).toContain('<ZelligePattern color={colors.textInverse} />');
    expect(residenceHeroSource).toContain('<ResidenceIllustration');
    expect(residenceHeroSource).toContain('end: spacing.md');
  });

  it('le titre long passe à la ligne sans passer sous l’illustration', () => {
    expect(residenceHeroSource).toContain('paddingEnd: spacing.lg + sizes.residenceHeroArt');
    expect(residenceHeroSource).not.toContain('numberOfLines');
  });

  it('affiche le nom et le rôle', () => {
    expect(residenceHeroSource).toContain('{name}');
    expect(residenceHeroSource).toContain('{roleLabel}');
  });
});
