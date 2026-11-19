// Étape 2 du plan 02b : états vides illustrés, cartes d'annonces, écran de bienvenue.
import { ANNOUNCEMENT_CATEGORIES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import layoutSource from '../app/_layout.tsx?raw';
import indexSource from '../app/index.tsx?raw';
import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import { welcomeArtFor } from '../lib/welcome-art';
import welcomeImageSource from '../lib/welcome-image.ts?raw';
import accountsSource from './accounts/accounts-screen.tsx?raw';
import announcementsScreenSource from './announcements/announcements-screen.tsx?raw';
import rowSource from './announcements/announcement-row.tsx?raw';
import latestSource from './announcements/latest-announcement-card.tsx?raw';
import welcomeScreenSource from './auth/welcome-screen.tsx?raw';
import chargeCallSource from './charges/charge-call-screen.tsx?raw';
import chargesSource from './charges/charges-screen.tsx?raw';
import collectSource from './charges/collect-screen.tsx?raw';
import myChargesSource from './charges/my-charges-screen.tsx?raw';
import newCallSource from './charges/new-charge-call-screen.tsx?raw';
import unpaidSource from './charges/unpaid-screen.tsx?raw';
import manageIssuesSource from './issues/manage-issues-screen.tsx?raw';
import residentIssuesSource from './issues/resident-issues-screen.tsx?raw';
import monthChargesSource from './home/month-charges-card.tsx?raw';
import lotsSource from './residences/lots-screen.tsx?raw';

/** Le(s) `<EmptyState …>` d'un écran, jusqu'à la fin de la balise. */
const emptyStates = (source: string) => source.match(/<EmptyState\b[\s\S]*?\n?\s*\/>|<EmptyState\b[\s\S]*?<\/EmptyState>/g) ?? [];
const domainsOf = (source: string) => emptyStates(source).map((tag) => tag.match(/domain="(\w+)"/)?.[1]);

describe('états vides illustrés : le bon domaine sur chaque écran de liste', () => {
  const expected: [string, string, string[]][] = [
    ['charges', 'charges-screen', ['charges']],
    ['mes charges', 'my-charges-screen', ['charges']],
    ['carte « Charges de … » de l’accueil', 'month-charges-card', ['charges']],
    ['encaissement', 'collect-screen', ['charges', 'charges']],
    ['impayés', 'unpaid-screen', ['charges']],
    ['détail d’un appel (aucun résultat)', 'charge-call-screen', ['charges']],
    ['nouvel appel sans appartement', 'new-charge-call-screen', ['apartments']],
    ['appartements', 'lots-screen', ['apartments']],
    ['mouvements de la caisse', 'accounts-screen', ['expenses']],
    ['signalements (habitant)', 'resident-issues-screen', ['issues']],
    ['signalements (syndic)', 'manage-issues-screen', ['issues']],
    ['annonces', 'announcements-screen', ['announcements', 'announcements']],
  ];
  const sources: Record<string, string> = {
    'charges-screen': chargesSource,
    'my-charges-screen': myChargesSource,
    'month-charges-card': monthChargesSource,
    'collect-screen': collectSource,
    'unpaid-screen': unpaidSource,
    'charge-call-screen': chargeCallSource,
    'new-charge-call-screen': newCallSource,
    'lots-screen': lotsSource,
    'accounts-screen': accountsSource,
    'resident-issues-screen': residentIssuesSource,
    'manage-issues-screen': manageIssuesSource,
    'announcements-screen': announcementsScreenSource,
  };

  for (const [label, file, domains] of expected) {
    it(`${label} : ${domains.join(' + ')}`, () => {
      expect(domainsOf(sources[file]!)).toEqual(domains);
      // Plus d'icône lucide à la place de l'illustration.
      for (const tag of emptyStates(sources[file]!)) expect(tag).not.toMatch(/^\s*icon=\{/m);
    });
  }

  it('signalements vides : « Tout va bien dans la résidence » et le nouveau texte, en français et en arabe', () => {
    expect(fr['issues.empty.title']).toBe('Tout va bien dans la résidence');
    expect(fr['issues.empty.body']).toBe(
      'Aucun signalement en cours. Si quelque chose ne marche pas, prévenez le syndic en deux gestes.',
    );
    expect(ar['issues.empty.title']).toMatch(/[؀-ۿ]/);
    expect(ar['issues.empty.body']).toMatch(/[؀-ۿ]/);
    expect(residentIssuesSource).toContain("'issues.empty.title'");
  });
});

describe('cartes d’annonces illustrées', () => {
  it('la bande illustrée suit la catégorie de l’annonce, au début de la carte (à droite en arabe)', () => {
    expect(rowSource).toContain('<CategoryArt category={item.category} />');
    expect(rowSource).toContain('width: sizes.categoryBand');
    expect(rowSource).toContain("flexDirection: 'row'");
    expect(rowSource).not.toMatch(/\bleft:|\bright:/);
  });

  it('badge de catégorie, titre, puis « Épinglée · Le syndic · date »', () => {
    expect(rowSource).toContain('<CategoryBadge category={item.category} />');
    expect(rowSource).toContain('{item.title}');
    expect(rowSource).toContain("t('announcements.pinnedMeta', { meta: metaText })");
    expect(fr['announcements.pinnedMeta']).toBe('Épinglée · {meta}');
    expect(ar['announcements.pinnedMeta']).toContain('{meta}');
  });

  it('une annonce épinglée garde la bordure marquée ; la carte est appuyable avec un libellé', () => {
    expect(rowSource).toContain('item.pinned ? colors.primary : colors.border');
    expect(rowSource).toContain('<PressableScale');
    expect(rowSource).toContain('accessibilityLabel');
  });

  it('filtres Toutes, Travaux, Assemblée, Info, Urgent', () => {
    expect(announcementsScreenSource).toContain('ANNOUNCEMENT_FILTERS.map');
    expect(announcementsScreenSource).toContain('<Chip');
    expect(announcementsScreenSource).toContain('data={list.loaded ? shown : []}');
    expect(fr['announcements.filter.all']).toBe('Toutes');
    expect([...ANNOUNCEMENT_CATEGORIES].map((c) => fr[`announcements.category.${c}`])).toEqual([
      'Travaux',
      'Assemblée',
      'Info',
      'Urgent',
    ]);
  });

  it('la carte « Dernière annonce » reprend la même illustration, en bandeau', () => {
    expect(latestSource).toContain('<CategoryArt category={item.category} />');
    expect(latestSource).toContain('height: sizes.categoryBanner');
    expect(latestSource).toContain('<CategoryBadge category={item.category} />');
  });
});

describe('écran de bienvenue', () => {
  it('l’image welcome.webp est utilisée si elle existe, sinon l’illustration SVG', () => {
    const image = 123;
    expect(welcomeArtFor(image)).toEqual({ kind: 'image', source: image });
    expect(welcomeArtFor(null)).toEqual({ kind: 'illustration' });
    // Le fichier est chargé en facultatif : sans lui, le build ne casse pas et `null` est renvoyé.
    expect(welcomeImageSource).toContain("require('../../assets/images/welcome.webp')");
    expect(welcomeImageSource).toMatch(/try \{[\s\S]*catch \{\s*return null;/);
    expect(welcomeScreenSource).toContain('welcomeArtFor(WELCOME_IMAGE)');
    expect(welcomeScreenSource).toContain("art.kind === 'image'");
    expect(welcomeScreenSource).toContain('<WelcomeScene');
  });

  it('aucune image n’est téléchargée : source locale uniquement, jamais une URL', () => {
    expect(welcomeScreenSource).not.toMatch(/https?:\/\//);
    expect(welcomeImageSource.replace(/\/\/.*$/gm, '')).not.toMatch(/https?:\/\//);
  });

  it('image en haut qui se fond vers le fond sable, logo texte, titre, sous-titre, deux boutons', () => {
    expect(welcomeScreenSource).toContain('sizes.welcomeImageShare');
    expect(welcomeScreenSource).toContain('fromOpacity={0}');
    expect(welcomeScreenSource).toContain('to={colors.bg}');
    for (const key of ['welcome.logoText', 'welcome.title', 'welcome.subtitle', 'welcome.createAccount', 'welcome.haveAccount']) {
      expect(welcomeScreenSource).toContain(`t('${key}')`);
    }
    expect(welcomeScreenSource).toContain("router.push('/sign-up')");
    expect(welcomeScreenSource).toContain("router.push('/sign-in')");
    expect(fr['welcome.logoText']).toBe('SYNDICAPP');
    expect(fr['welcome.title']).toBe('Votre résidence, en toute transparence');
    expect(fr['welcome.createAccount']).toBe('Créer un compte');
    expect(fr['welcome.haveAccount']).toBe('J’ai déjà un compte');
  });

  it('affiché seulement déconnecté : le groupe (auth) est protégé par !signedIn, la racine redirige', () => {
    const guarded = layoutSource.match(/<Stack\.Protected guard=\{!signedIn\}>([\s\S]*?)<\/Stack\.Protected>/);
    expect(guarded?.[1]).toContain('name="(auth)"');
    expect(layoutSource).toMatch(/<Stack\.Protected guard=\{signedIn\}>[\s\S]*?name="\(app\)"/);
    expect(indexSource).toContain("user ? '/home' : '/welcome'");
  });

  it('une invitation ou un lien qui ouvre l’appli garde son parcours : invite/[code] est hors du groupe (auth)', () => {
    const outside = layoutSource.split('<Stack.Protected')[0]!;
    expect(outside).toContain('name="invite/[code]"');
    // Seules navigations : création de compte, connexion, et (en développement) la galerie.
    expect((welcomeScreenSource.match(/router\.push\('([^']+)'/g) ?? []).sort()).toEqual([
      "router.push('/dev/design-system'",
      "router.push('/sign-in'",
      "router.push('/sign-up'",
    ]);
  });

  it('l’écran est en RTL sans left/right et ne code aucune valeur de style', () => {
    expect(welcomeScreenSource).not.toMatch(/\bleft:|\bright:/);
    expect(welcomeScreenSource).toContain('end: layout.screenPadding');
    expect(welcomeScreenSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
