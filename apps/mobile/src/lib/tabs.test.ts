import { ROLES, type Role } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import {
  TAB_ROUTES,
  accountsHref,
  isTabRoute,
  shouldResetToHome,
  tabRoutesForRole,
  tabsForRole,
} from './tabs';

const labels = (role: Role | null) => tabsForRole(role).map((tab) => fr[tab.labelKey]);

describe('onglets selon le rôle (tableau du plan 02b)', () => {
  it('syndic et trésorier : Accueil, Charges, Signalements, Annonces, Profil', () => {
    for (const role of ['manager', 'treasurer'] as const) {
      expect(labels(role)).toEqual(['Accueil', 'Charges', 'Signalements', 'Annonces', 'Profil']);
      expect(tabRoutesForRole(role)).toEqual(['home', 'charges', 'issues', 'announcements', 'profile']);
    }
  });

  it('adjoint : Accueil, Comptes, Signalements, Annonces, Profil', () => {
    expect(labels('deputy')).toEqual(['Accueil', 'Comptes', 'Signalements', 'Annonces', 'Profil']);
    expect(tabRoutesForRole('deputy')).toEqual(['home', 'accounts-tab', 'issues', 'announcements', 'profile']);
  });

  it('copropriétaire : Accueil, Mes charges, Signaler, Annonces, Profil', () => {
    expect(labels('owner')).toEqual(['Accueil', 'Mes charges', 'Signaler', 'Annonces', 'Profil']);
    expect(tabRoutesForRole('owner')).toEqual(['home', 'my-charges', 'issues', 'announcements', 'profile']);
  });

  it('locataire et gardien : Accueil, Signalements, Annonces, Profil', () => {
    for (const role of ['tenant', 'caretaker'] as const) {
      expect(labels(role)).toEqual(['Accueil', 'Signalements', 'Annonces', 'Profil']);
      expect(tabRoutesForRole(role)).toEqual(['home', 'issues', 'announcements', 'profile']);
    }
  });

  it('sans résidence : Accueil et Profil seulement', () => {
    expect(tabRoutesForRole(null)).toEqual(['home', 'profile']);
  });

  it('chaque rôle voit 4 ou 5 onglets, sans doublon, Accueil en premier et Profil en dernier', () => {
    for (const role of ROLES) {
      const routes = tabRoutesForRole(role);
      expect(routes.length).toBeGreaterThanOrEqual(4);
      expect(routes.length).toBeLessThanOrEqual(5);
      expect(new Set(routes).size).toBe(routes.length);
      expect(routes[0]).toBe('home');
      expect(routes.at(-1)).toBe('profile');
    }
  });

  it('aucun onglet de comptes ou de charges pour un locataire ou un gardien', () => {
    for (const role of ['tenant', 'caretaker'] as const) {
      const routes = tabRoutesForRole(role);
      expect(routes).not.toContain('charges');
      expect(routes).not.toContain('my-charges');
      expect(routes).not.toContain('accounts-tab');
    }
  });

  it('chaque libellé existe en français et en arabe', () => {
    for (const role of [...ROLES, null] as (Role | null)[]) {
      for (const tab of tabsForRole(role)) {
        expect(fr[tab.labelKey]).toBeTruthy();
        expect(ar[tab.labelKey]).toBeTruthy();
      }
    }
  });
});

describe('retour sur Accueil quand l’onglet actif disparaît', () => {
  it('syndic → copropriétaire : « Charges » n’existe plus, retour sur Accueil', () => {
    expect(shouldResetToHome('manager', 'charges')).toBe(false);
    expect(shouldResetToHome('owner', 'charges')).toBe(true);
  });

  it('copropriétaire → locataire : « Mes charges » disparaît', () => {
    expect(shouldResetToHome('owner', 'my-charges')).toBe(false);
    expect(shouldResetToHome('tenant', 'my-charges')).toBe(true);
  });

  it('adjoint : « Comptes » est un onglet ; pour un syndic, il n’en est pas un', () => {
    expect(shouldResetToHome('deputy', 'accounts-tab')).toBe(false);
    expect(shouldResetToHome('manager', 'accounts-tab')).toBe(true);
  });

  it('Accueil, Signalements, Annonces et Profil restent pour tous les rôles', () => {
    for (const role of ROLES) {
      for (const route of ['home', 'issues', 'announcements', 'profile']) {
        expect(shouldResetToHome(role, route)).toBe(false);
      }
    }
  });

  it('sans résidence, seuls Accueil et Profil existent', () => {
    expect(shouldResetToHome(null, 'home')).toBe(false);
    expect(shouldResetToHome(null, 'profile')).toBe(false);
    expect(shouldResetToHome(null, 'issues')).toBe(true);
  });

  it('un écran qui n’est pas un onglet n’est jamais corrigé', () => {
    expect(shouldResetToHome('tenant', 'accounts')).toBe(false);
    expect(shouldResetToHome('tenant', '(tabs)')).toBe(false);
  });
});

describe('routes', () => {
  it('reconnaît les routes d’onglets', () => {
    for (const route of TAB_ROUTES) expect(isTabRoute(route)).toBe(true);
    expect(isTabRoute('accounts')).toBe(false);
    expect(isTabRoute('lots')).toBe(false);
  });

  it('les comptes s’ouvrent en onglet pour l’adjoint, au-dessus des onglets pour les autres', () => {
    expect(accountsHref('deputy')).toBe('/accounts-tab');
    for (const role of ['manager', 'treasurer', 'owner'] as const) expect(accountsHref(role)).toBe('/accounts');
  });
});
