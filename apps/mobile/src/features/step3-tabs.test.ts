// Étape 3 du plan 02b : barre d'onglets selon le rôle, accueils, Profil. Tests de structure (fichiers
// de routes, sources) et de comportement des fonctions pures ; les règles par rôle sont dans
// lib/tabs.test.ts, lib/home.test.ts et lib/profile.test.ts.
import { NOTIFICATION_TYPES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import appLayoutSource from '../app/(app)/_layout.tsx?raw';
import tabsLayoutSource from '../app/(app)/(tabs)/_layout.tsx?raw';
import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import notificationHookSource from '../hooks/use-notification-navigation.ts?raw';
import sessionHookSource from '../hooks/use-session.ts?raw';
import { TAB_ROUTES } from '../lib/tabs';
import { notificationRoutes, routeIsTab, type NotificationRoute } from '../lib/notification-target';
import latestAnnouncementSource from './announcements/latest-announcement-card.tsx?raw';
import chargesScreenSource from './charges/charges-screen.tsx?raw';
import newChargeCallSource from './charges/new-charge-call-screen.tsx?raw';
import homeScreenSource from './home/home-screen.tsx?raw';
import addLotsSource from './residences/add-lots-screen.tsx?raw';
import joinSource from './residences/join-screen.tsx?raw';
import residentHomeSource from './home/resident-home.tsx?raw';
import staffHomeSource from './home/staff-home.tsx?raw';
import attentionSource from './home/attention-pills.tsx?raw';
import balanceSource from './home/balance-card.tsx?raw';
import monthChargesSource from './home/month-charges-card.tsx?raw';
import quickActionsSource from './home/quick-actions.tsx?raw';
import homeHeaderSource from './home/home-header.tsx?raw';
import noResidenceSource from './home/no-residence-choices.tsx?raw';
import roleTabBarSource from './navigation/role-tab-bar.tsx?raw';
import profileSource from './profile/profile-screen.tsx?raw';

// Toutes les routes du groupe (app), lues sur le disque par Vite (« dossier/fichier », sans extension).
// Les parenthèses des groupes d'Expo Router sont échappées : sinon le motif les prend pour un groupe de choix.
// @ts-ignore -- les types de Vite (import.meta.glob) ne sont pas chargés dans l'appli ; le test les utilise.
const routeModules: Record<string, unknown> = import.meta.glob('../app/\\(app\\)/**/*.tsx');
const appRoutes = Object.keys(routeModules).map((path) => path.replace('../app/(app)/', '').replace(/\.tsx$/, ''));
const tabFiles = appRoutes.filter((path) => path.startsWith('(tabs)/')).map((path) => path.replace('(tabs)/', ''));
const detailRoutes = appRoutes.filter((path) => !path.startsWith('(tabs)/') && path !== '_layout');

describe('routes : onglets et écrans de détail', () => {
  it('le groupe (tabs) contient exactement les routes d’onglets et son layout', () => {
    expect(tabFiles.filter((file) => file !== '_layout').sort()).toEqual([...TAB_ROUTES].sort());
    expect(tabFiles).toContain('_layout');
  });

  it('les écrans de détail sont hors des onglets : ils s’ouvrent au-dessus, avec un bouton retour', () => {
    for (const route of [
      'charge-call/[id]',
      'issue/[id]',
      'announcement/[id]',
      'expense/[id]',
      'receipt/[id]',
      'unpaid/[id]',
      'lot/[id]',
      'invitation/[id]',
      'lots',
      'accounts',
      'notifications',
      'add-expense',
      'new-issue',
      'invite-neighbor',
      'push-intro',
      'join',
    ]) {
      expect(detailRoutes, route).toContain(route);
      expect(tabFiles, route).not.toContain(route);
    }
  });

  it('l’ancre du groupe (app) est le groupe d’onglets', () => {
    expect(appLayoutSource).toContain("anchor: '(tabs)'");
  });

  it('invitations et bienvenue gardent leur parcours : routes hors onglets inchangées', () => {
    expect(detailRoutes).toEqual(expect.arrayContaining(['join', 'invite-neighbor', 'invitation/[id]', 'push-intro']));
    expect(homeScreenSource).toContain("from './no-residence-choices'");
    expect(noResidenceSource).toContain("router.push('/create-residence')");
    expect(noResidenceSource).toContain("router.push('/join')");
    // L'écran « Restez informé » reste lancé une seule fois par le layout du groupe (app).
    expect(appLayoutSource).toContain('runPushStartup');
    expect(appLayoutSource).toContain("router.push('/push-intro')");
  });
});

describe('barre d’onglets : implémentation', () => {
  it('barre personnalisée : le TabBar du design system sur les Tabs d’Expo Router, jamais NativeTabs', () => {
    expect(tabsLayoutSource).toContain("import { Tabs } from 'expo-router'");
    expect(tabsLayoutSource).not.toContain('native-tabs');
    expect(roleTabBarSource).toContain('TabBar');
    expect(roleTabBarSource).not.toContain('unstable-native-tabs');
  });

  it('aucune animation au changement d’onglet', () => {
    expect(tabsLayoutSource).toContain("animation: 'none'");
    expect(roleTabBarSource).not.toMatch(/Animated|withTiming|withSpring|LayoutAnimation/);
  });

  it('chaque route d’onglet est déclarée et cachée selon le rôle', () => {
    expect(tabsLayoutSource).toContain('TAB_ROUTES.map');
    expect(tabsLayoutSource).toContain('hidden:');
    expect(tabsLayoutSource).toContain('tabRoutesForRole');
  });

  it('les onglets viennent du rôle de la résidence active et reviennent sur Accueil si l’onglet disparaît', () => {
    expect(roleTabBarSource).toContain('tabsForRole');
    expect(roleTabBarSource).toContain('shouldResetToHome');
    expect(roleTabBarSource).toContain('useActiveResidence');
  });

  it('un lien profond n’est pas écarté tant que les résidences ne sont pas connues', () => {
    expect(roleTabBarSource).toContain('query.data !== undefined');
    expect(tabsLayoutSource).toContain('query.data !== undefined');
  });
});

describe('accueil : ce qui change selon le rôle', () => {
  it('l’accueil de gestion (syndic, trésorier, adjoint) montre le solde, « À traiter » et l’accès rapide', () => {
    expect(staffHomeSource).toContain('ResidenceHero');
    expect(staffHomeSource).toContain('showsCashCard(role)');
    expect(staffHomeSource).toContain('AttentionPills');
    expect(staffHomeSource).toContain('quickActionsFor(role)');
  });

  it('locataire et gardien : aucune carte de charges, aucune requête de charges', () => {
    expect(residentHomeSource).toContain('{isOwner && <MonthChargesCard');
    expect(residentHomeSource).toContain('useMyDues(isOwner ? residence.id : undefined)');
    expect(residentHomeSource).toContain('showsChargesCard(role)');
  });

  it('l’accueil de l’habitant garde la dernière annonce illustrée', () => {
    expect(residentHomeSource).toContain('LatestAnnouncementCard');
  });

  it('chaque requête de l’accueil est limitée au rôle qui a la permission', () => {
    expect(attentionSource).toContain('seesUnpaid(role) ? residenceId : undefined');
    expect(attentionSource).toContain('seesIssuesToHandle(role) ? residenceId : undefined');
  });

  it('la carte des charges a un état de chargement, d’erreur, vide et positif (tout est payé)', () => {
    expect(monthChargesSource).toContain('Skeleton');
    expect(monthChargesSource).toContain('QueryFallback');
    expect(monthChargesSource).toContain('<EmptyState domain="charges"');
    expect(monthChargesSource).toContain('card.settled');
    expect(monthChargesSource).toContain('home.charges.allPaidTitle');
    expect(monthChargesSource).toContain('ProgressBar');
    expect(monthChargesSource).toContain('StatusBadge');
    expect(monthChargesSource).toContain("router.navigate('/my-charges')");
  });

  it('la carte du solde utilise Amount, les routes de la caisse existantes, et la courbe seulement avec des données', () => {
    expect(balanceSource).toContain('<Amount centimes={balance} variant="display"');
    expect(balanceSource).toContain("from '@/hooks/use-cash'");
    expect(balanceSource).toContain('balanceSeries(balance, ledger.items)');
    expect(balanceSource).toContain('<Sparkline values={series}');
    expect(balanceSource).toContain('Skeleton');
    expect(balanceSource).toContain('QueryFallback');
  });

  it('la grille d’accès rapide utilise ActionTile en pastille duotone, et les onglets s’ouvrent avec navigate', () => {
    expect(quickActionsSource).toContain('domain={action.domain}');
    expect(quickActionsSource).toContain('router.navigate(action.href as Href)');
    expect(quickActionsSource).toContain('router.push(action.href as Href)');
  });

  it('les pastilles ouvrent les impayés (au-dessus des onglets) ou un onglet', () => {
    expect(attentionSource).toContain("item.href.pathname === '/unpaid/[id]'");
    expect(attentionSource).toContain('router.navigate');
  });

  it('l’ancien accueil a perdu ce qui est passé dans les onglets ou le Profil', () => {
    for (const source of [homeScreenSource, staffHomeSource, residentHomeSource]) {
      expect(source).not.toContain('signOut');
      expect(source).not.toContain("'/notifications'");
      expect(source).not.toContain('/dev/design-v2');
      expect(source).not.toContain('LanguageToggle');
      expect(source).not.toContain('residences.switcher.label');
      expect(source).not.toContain('home.lotsBody');
    }
  });

  it('l’accueil a quatre états : chargement (squelettes), erreur (« Réessayer »), vide (sans résidence), contenu', () => {
    expect(homeScreenSource).toContain('HomeSkeleton');
    expect(homeScreenSource).toContain("t('common.retry')");
    expect(homeScreenSource).toContain('NoResidenceChoices');
    expect(homeScreenSource).toContain('StaffHome');
    expect(homeScreenSource).toContain('ResidentHome');
    expect(homeHeaderSource).toContain('Skeleton');
  });
});

describe('Profil', () => {
  it('la galerie visuelle n’est montrée que par profileEntries({ isDev: __DEV__ })', () => {
    expect(profileSource).toContain('isDev: __DEV__');
    expect(profileSource).toContain("{has('gallery') && (");
  });

  it('la déconnexion passe par useSession().signOut, qui supprime le jeton push avant la fin de la session', () => {
    expect(profileSource).toContain("from '@/hooks/use-session'");
    expect(profileSource).toContain('await signOut()');
    expect(sessionHookSource).toContain('signOutWithPushCleanup');
    expect(sessionHookSource).toContain('unregister: () => unregisterPushToken(pushDeps)');
  });

  it('reprend les écrans existants : notifications, langue, résidence', () => {
    expect(profileSource).toContain("router.push('/notifications')");
    expect(profileSource).toContain('setLanguage');
    expect(profileSource).toContain('setActive(residence.id)');
    expect(profileSource).toContain('<Avatar name={me.data.name} single');
  });

  it('quatre états : chargement (squelettes), erreur, vide (aucune résidence), contenu', () => {
    expect(profileSource).toContain('Skeleton');
    expect(profileSource).toContain('QueryFallback');
    expect(profileSource).toContain("t('profile.noResidence')");
  });
});

describe('règles d’AGENTS.md : jetons uniquement, icônes par Icon, start/end', () => {
  const sources = {
    'home-screen': homeScreenSource,
    'staff-home': staffHomeSource,
    'resident-home': residentHomeSource,
    'attention-pills': attentionSource,
    'balance-card': balanceSource,
    'month-charges-card': monthChargesSource,
    'quick-actions': quickActionsSource,
    'home-header': homeHeaderSource,
    'no-residence-choices': noResidenceSource,
    'role-tab-bar': roleTabBarSource,
    'profile-screen': profileSource,
    'tabs-layout': tabsLayoutSource,
  };

  it.each(Object.entries(sources))('%s : aucune couleur, taille de police ni rayon codés en dur', (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/rgba?\(/);
    expect(source).not.toMatch(/fontSize:\s*\d/);
    expect(source).not.toMatch(/borderRadius:\s*\d/);
    expect(source).not.toMatch(/(?:padding|margin|gap|width|height|minHeight):\s*\d/);
    expect(source).not.toMatch(/opacity:\s*0?\.\d/);
  });

  it.each(Object.entries(sources))('%s : jamais left/right, toujours start/end', (_name, source) => {
    expect(source).not.toMatch(/\b(?:marginLeft|marginRight|paddingLeft|paddingRight|left|right):/);
  });

  it.each(Object.entries(sources))('%s : icônes lucide importées une par une, jamais depuis l’index', (_name, source) => {
    expect(source).not.toMatch(/from 'lucide-react-native'/);
  });
});

describe('toucher d’une notification : le bon écran, avec les onglets', () => {
  const ID = '0b9bd1d4-7b7b-4b60-9c1c-6a1f0f2a7c11';
  const RESIDENCE = '5d1d6a42-1f0a-4c1e-8d0f-0c5a6f3a9b22';
  const routeFile = (route: NotificationRoute) => route.pathname.replace(/^\//, '');

  it('chaque écran ouvert par une notification existe, et seul « Mes charges » est un onglet', () => {
    for (const type of NOTIFICATION_TYPES) {
      const routes = notificationRoutes({ type, residenceId: RESIDENCE, itemId: ID });
      expect(routes.length, type).toBeGreaterThan(0);
      for (const route of routes) {
        const file = routeFile(route);
        if (routeIsTab(route)) expect(tabFiles, `${type} → ${file}`).toContain(file);
        else expect(detailRoutes, `${type} → ${file}`).toContain(file);
      }
    }
  });

  it('annonce, signalement et reçu s’ouvrent au-dessus des onglets ; « Mes charges » est un onglet', () => {
    const open = (type: (typeof NOTIFICATION_TYPES)[number]) => notificationRoutes({ type, residenceId: RESIDENCE, itemId: ID });
    expect(open('announcement').map(routeIsTab)).toEqual([false]);
    expect(open('announcement_urgent').map(routeIsTab)).toEqual([false]);
    expect(open('issue_status').map(routeIsTab)).toEqual([false]);
    expect(open('issue_urgent').map(routeIsTab)).toEqual([false]);
    expect(open('charge_reminder').map(routeIsTab)).toEqual([true]);
    // Paiement reçu : l'onglet « Mes charges », puis le reçu au-dessus.
    expect(open('payment_received').map(routeIsTab)).toEqual([true, false]);
  });

  it('le toucher ouvre un onglet avec navigate, un détail avec push, et l’accueil avec navigate', () => {
    expect(notificationHookSource).toContain('if (routeIsTab(route)) router.navigate(route);');
    expect(notificationHookSource).toContain('else router.push(route);');
    expect(notificationHookSource).toContain("router.navigate('/home')");
  });

  it('un copropriétaire qui touche « paiement reçu » arrive sur Mes charges (onglet qui existe pour lui)', () => {
    expect(fr['tabs.myCharges']).toBeTruthy();
    expect(tabFiles).toContain('my-charges');
  });
});

describe('traductions FR et AR des nouveaux textes', () => {
  const ARABIC_LETTER = /[؀-ۿ]/;
  const NO_WORDS = new Set(['home.date', 'profile.language.fr']);
  const keys = (Object.keys(fr) as (keyof typeof fr)[]).filter((key) => key.startsWith('tabs.') || key.startsWith('profile.') || /^home\.(date|weekday|heroRole|cash|attention|quick|charges)/.test(key));

  it('il y a des clés à vérifier', () => {
    expect(keys.length).toBeGreaterThan(40);
  });

  it('chaque clé existe en français et en arabe', () => {
    for (const key of keys) {
      expect(fr[key], `fr : ${key}`).toBeTruthy();
      expect(ar[key], `ar : ${key}`).toBeTruthy();
      if (!NO_WORDS.has(key)) expect(ar[key], `ar : ${key}`).toMatch(ARABIC_LETTER);
    }
  });

  it('les paramètres {…} sont les mêmes en français et en arabe', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of keys) expect(placeholders(ar[key]), key).toEqual(placeholders(fr[key]));
  });

  it('singulier et pluriel : « 1 impayé » / « 3 impayés », « 1 signalement urgent » / « 2 signalements urgents »', () => {
    expect(fr['home.attention.unpaid.one']).toBe('1 impayé');
    expect(fr['home.attention.unpaid.other']).toContain('{count}');
    expect(fr['home.attention.urgent.one']).toBe('1 signalement urgent');
    expect(fr['home.attention.urgent.other']).toBe('{count} signalements urgents');
    expect(fr['home.attention.toHandle.one']).toBe('1 signalement à traiter');
    // Le singulier arabe n'a pas de nombre ; le pluriel en a un.
    for (const kind of ['unpaid', 'urgent', 'toHandle'] as const) {
      expect(ar[`home.attention.${kind}.one` as const]).not.toContain('{count}');
      expect(ar[`home.attention.${kind}.other` as const]).toContain('{count}');
    }
  });

  it('les sept jours de la semaine sont traduits', () => {
    for (let day = 1; day <= 7; day += 1) {
      const key = `home.weekday.${day}` as keyof typeof fr;
      expect(fr[key]).toBeTruthy();
      expect(ar[key]).toMatch(ARABIC_LETTER);
    }
  });

  it('libellés exacts des onglets en français', () => {
    expect([fr['tabs.home'], fr['tabs.charges'], fr['tabs.accounts'], fr['tabs.myCharges'], fr['tabs.issues'], fr['tabs.report'], fr['tabs.announcements'], fr['tabs.profile']]).toEqual([
      'Accueil',
      'Charges',
      'Comptes',
      'Mes charges',
      'Signalements',
      'Signaler',
      'Annonces',
      'Profil',
    ]);
  });
});

describe('parcours qui reviennent sur un onglet : navigate, jamais un second jeu d’onglets empilé', () => {
  it('créer un appel de charges revient sur l’onglet Charges avec le message de confirmation', () => {
    expect(newChargeCallSource).toContain("router.navigate({ pathname: '/charges', params: { created: '1' } })");
    expect(newChargeCallSource).not.toContain("router.replace({ pathname: '/charges'");
    // L'onglet est déjà ouvert : le message se lit dans un effet, puis le paramètre est consommé.
    expect(chargesScreenSource).toContain("if (created !== '1') return;");
    expect(chargesScreenSource).toContain('router.setParams({ created: undefined })');
  });

  it('rejoindre une résidence et finir l’ajout des appartements reviennent sur l’accueil', () => {
    // Après l'acceptation du code (le retour de secours, sans historique, garde `replace`).
    expect(joinSource).toMatch(/mutateAsync\(complete\);[\s\S]{0,200}router\.navigate\('\/home'\)/);
    expect(addLotsSource).toContain("router.navigate('/home')");
    expect(addLotsSource).not.toContain("router.replace('/home')");
  });

  it('« Voir toutes les annonces » ouvre l’onglet Annonces', () => {
    expect(latestAnnouncementSource).toContain("router.navigate('/announcements')");
  });
});
