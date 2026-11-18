// Barre d'onglets selon le rôle dans la résidence active (plan 02b, étape 3). Fonctions pures, sans
// React ni Expo Router : testées avec vitest. Le tableau des onglets est celui du plan :
//
//   manager, treasurer : Accueil, Charges, Signalements, Annonces, Profil
//   deputy             : Accueil, Comptes, Signalements, Annonces, Profil
//   owner              : Accueil, Mes charges, Signaler, Annonces, Profil
//   tenant, caretaker  : Accueil, Signalements, Annonces, Profil
//
// Sans résidence (compte neuf) : Accueil (créer ou rejoindre) et Profil. Les onglets ne servent qu'à
// naviguer : c'est l'API qui refuse ce que le rôle ne peut pas faire.
import type { Role } from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

/**
 * Routes du groupe `(app)/(tabs)`. `accounts-tab` est l'onglet « Comptes » de l'adjoint : les autres
 * rôles ouvrent les comptes par l'écran `/accounts`, au-dessus des onglets (avec un bouton retour).
 */
export const TAB_ROUTES = [
  'home',
  'charges',
  'my-charges',
  'accounts-tab',
  'issues',
  'announcements',
  'profile',
] as const;

export type TabRoute = (typeof TAB_ROUTES)[number];

/** Icônes lucide de la barre (importées une par une dans le layout, affichées par `Icon`). */
export type TabIcon = 'house' | 'wallet' | 'chart-column' | 'flag' | 'megaphone' | 'user';

export type TabSpec = { route: TabRoute; labelKey: TranslationKey; icon: TabIcon };

const HOME: TabSpec = { route: 'home', labelKey: 'tabs.home', icon: 'house' };
const ANNOUNCEMENTS: TabSpec = { route: 'announcements', labelKey: 'tabs.announcements', icon: 'megaphone' };
const PROFILE: TabSpec = { route: 'profile', labelKey: 'tabs.profile', icon: 'user' };
const ISSUES: TabSpec = { route: 'issues', labelKey: 'tabs.issues', icon: 'flag' };

/** Onglets d'un rôle, dans l'ordre d'affichage. `null` : aucune résidence active. */
export function tabsForRole(role: Role | null): readonly TabSpec[] {
  switch (role) {
    case null:
      return [HOME, PROFILE];
    case 'manager':
    case 'treasurer':
      return [HOME, { route: 'charges', labelKey: 'tabs.charges', icon: 'wallet' }, ISSUES, ANNOUNCEMENTS, PROFILE];
    case 'deputy':
      return [
        HOME,
        { route: 'accounts-tab', labelKey: 'tabs.accounts', icon: 'chart-column' },
        ISSUES,
        ANNOUNCEMENTS,
        PROFILE,
      ];
    case 'owner':
      return [
        HOME,
        { route: 'my-charges', labelKey: 'tabs.myCharges', icon: 'wallet' },
        { ...ISSUES, labelKey: 'tabs.report' },
        ANNOUNCEMENTS,
        PROFILE,
      ];
    case 'tenant':
    case 'caretaker':
      return [HOME, ISSUES, ANNOUNCEMENTS, PROFILE];
  }
}

/** Routes visibles dans la barre pour ce rôle. */
export const tabRoutesForRole = (role: Role | null): readonly TabRoute[] => tabsForRole(role).map((tab) => tab.route);

export const isTabRoute = (name: string): name is TabRoute => (TAB_ROUTES as readonly string[]).includes(name);

/**
 * Faut-il revenir sur Accueil ? Oui quand l'onglet affiché n'existe plus pour ce rôle : changement
 * de résidence (donc de rôle), ou rôle qui change. Un onglet affiché hors de la barre ne se corrige
 * jamais en silence : on revient sur Accueil, qui existe pour tous.
 */
export function shouldResetToHome(role: Role | null, focusedRoute: string): boolean {
  return isTabRoute(focusedRoute) && !tabRoutesForRole(role).includes(focusedRoute);
}

/** Route des comptes : l'onglet pour l'adjoint, l'écran au-dessus des onglets pour les autres. */
export const accountsHref = (role: Role): '/accounts-tab' | '/accounts' => (role === 'deputy' ? '/accounts-tab' : '/accounts');
