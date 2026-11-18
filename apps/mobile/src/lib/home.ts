// Accueils du plan 02b (étape 3) : règles pures, sans React ni Expo Router, testées avec vitest.
// Aucune règle métier ne change : tout vient des routes existantes (caisse, appels de charges,
// compteurs de signalements, mes charges). L'accueil masque ce que le rôle ne peut pas faire, et
// l'API refuse de toute façon.
import { can, type Role } from '@syndic/shared';

import type { ChargeCallSummary, MyDue } from '@/hooks/use-charges';
import type { IssueCounts } from '@/lib/issues';

import { canManageCharges } from '../features/charges/access';
import { casablancaDate, dateParts } from './charges-format';
import { canSeeAccounts, type LedgerEntry } from './cash';
import { accountsHref } from './tabs';

// ---------------------------------------------------------------------------------------------
// Salutation

/** Jour de la semaine (1 = lundi … 7 = dimanche), jour et mois (1 à 12) à Casablanca. */
export function todayParts(now: Date = new Date()): { weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; day: number; month: number } {
  const { year, month, day } = dateParts(casablancaDate(now));
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { weekday: (sunday0 === 0 ? 7 : sunday0) as 1 | 2 | 3 | 4 | 5 | 6 | 7, day, month };
}

/** Prénom : premier mot du nom. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

// ---------------------------------------------------------------------------------------------
// Type d'accueil

/**
 * Accueil « gestion » (syndic, trésorier, adjoint : solde, à traiter, accès rapide) ou accueil
 * « habitant » (copropriétaire, locataire, gardien).
 */
export type HomeKind = 'staff' | 'resident';

export const homeKindFor = (role: Role): HomeKind =>
  role === 'manager' || role === 'treasurer' || role === 'deputy' ? 'staff' : 'resident';

/** Carte « Solde de la caisse » : rôles avec `accounts.read` de l'accueil de gestion. */
export const showsCashCard = (role: Role): boolean => homeKindFor(role) === 'staff' && canSeeAccounts(role);

// ---------------------------------------------------------------------------------------------
// Solde de la caisse

/** Nombre maximal de mouvements pris pour la petite courbe. */
export const SPARKLINE_MAX_ENTRIES = 12;

/**
 * Soldes successifs de la caisse, du plus ancien au plus récent, retrouvés à rebours à partir du
 * solde actuel et des derniers mouvements du journal (du plus récent au plus ancien). Un mouvement
 * annulé ne compte pas, comme dans le solde. Donnée déjà fournie par GET /api/cash : aucune API.
 * Moins de 3 points : pas de courbe (le composant ne dessine rien).
 */
export function balanceSeries(balance: number, entries: readonly LedgerEntry[]): number[] {
  const series = [balance];
  let current = balance;
  for (const entry of entries.filter((e) => !e.cancelled).slice(0, SPARKLINE_MAX_ENTRIES)) {
    current -= entry.direction === 'in' ? entry.amount : -entry.amount;
    series.push(current);
  }
  return series.reverse();
}

// ---------------------------------------------------------------------------------------------
// « À traiter »

/** Lots à relancer : impayés et partiels, dans tous les appels (le même critère que l'écran des impayés). */
export const unpaidTotal = (calls: readonly Pick<ChargeCallSummary, 'unpaidCount' | 'partialCount'>[]): number =>
  calls.reduce((sum, call) => sum + call.unpaidCount + call.partialCount, 0);

export type AttentionKind = 'unpaid' | 'urgent' | 'toHandle';

export type AttentionItem = {
  kind: AttentionKind;
  count: number;
  href: AttentionHref;
};

export type AttentionHref =
  | { pathname: '/unpaid/[id]'; params: { id: string } }
  | { pathname: '/charges' }
  | { pathname: '/accounts-tab' }
  | { pathname: '/issues'; params: { filter: 'urgent' | 'open' } };

/** Qui peut lire les impayés : `accounts.read`, et seulement les rôles de l'accueil de gestion. */
export const seesUnpaid = (role: Role): boolean => homeKindFor(role) === 'staff' && can(role, 'accounts.read');

/** Signalements urgents et à traiter : `issues.manage` (syndic, adjoint, gardien). */
export const seesIssuesToHandle = (role: Role): boolean => can(role, 'issues.manage');

/**
 * Où ouvrent les impayés : l'écran des impayés d'un appel quand un seul appel en a et que le rôle
 * peut relancer (syndic) ; sinon l'onglet Charges, qui liste les appels avec leurs impayés. L'adjoint
 * lit les comptes mais n'a pas d'onglet Charges : sa pastille ouvre l'onglet Comptes.
 */
export function unpaidHref(
  role: Role,
  calls: readonly Pick<ChargeCallSummary, 'id' | 'unpaidCount' | 'partialCount'>[],
): AttentionHref {
  if (!canManageCharges(role)) return { pathname: '/accounts-tab' };
  const withUnpaid = calls.filter((call) => call.unpaidCount + call.partialCount > 0);
  const only = withUnpaid.length === 1 ? withUnpaid[0] : undefined;
  if (only !== undefined && can(role, 'charges.write') && can(role, 'payments.write')) {
    return { pathname: '/unpaid/[id]', params: { id: only.id } };
  }
  return { pathname: '/charges' };
}

/**
 * Pastilles « À traiter », cachées quand le nombre est 0 :
 *  - impayés (accounts.read) ouvrent les impayés ;
 *  - signalements urgents (issues.manage) ouvrent la liste filtrée sur les urgents ;
 *  - gardien : ses signalements à traiter (ouverts) ouvrent la liste des ouverts.
 * Un nombre inconnu (chargement ou erreur) n'affiche rien.
 */
export function attentionItems(
  role: Role,
  data: {
    calls: readonly Pick<ChargeCallSummary, 'id' | 'unpaidCount' | 'partialCount'>[] | undefined;
    counts: Pick<IssueCounts, 'open' | 'in_progress' | 'urgentUnresolved'> | undefined;
  },
): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (seesUnpaid(role) && data.calls !== undefined) {
    const count = unpaidTotal(data.calls);
    if (count > 0) items.push({ kind: 'unpaid', count, href: unpaidHref(role, data.calls) });
  }
  if (seesIssuesToHandle(role) && data.counts !== undefined) {
    if (homeKindFor(role) === 'staff') {
      const count = data.counts.urgentUnresolved;
      if (count > 0) items.push({ kind: 'urgent', count, href: { pathname: '/issues', params: { filter: 'urgent' } } });
    } else {
      // Le gardien traite ce qui est ouvert : un signalement déjà en cours est pris en charge.
      const toHandle = data.counts.open;
      if (toHandle > 0) items.push({ kind: 'toHandle', count: toHandle, href: { pathname: '/issues', params: { filter: 'open' } } });
      const urgent = data.counts.urgentUnresolved;
      if (urgent > 0) items.push({ kind: 'urgent', count: urgent, href: { pathname: '/issues', params: { filter: 'urgent' } } });
    }
  }
  return items;
}

/** Clé de traduction d'une pastille, au singulier pour 1. */
export const attentionKey = (kind: AttentionKind, count: number) =>
  `home.attention.${kind}.${count === 1 ? 'one' : 'other'}` as const;

// ---------------------------------------------------------------------------------------------
// Accès rapide

export type QuickActionId = 'lots' | 'charges' | 'expense' | 'issues' | 'announcements' | 'accounts' | 'report';

export type QuickAction = {
  id: QuickActionId;
  /** Domaine du design system : couleur de la pastille d'icône. */
  domain: 'residence' | 'charges' | 'expenses' | 'issues' | 'announcements' | 'accounts';
  /** Écran ouvert : un onglet, ou un écran au-dessus des onglets. */
  href: '/lots' | '/charges' | '/add-expense' | '/issues' | '/announcements' | '/accounts' | '/accounts-tab' | '/new-issue';
  /** Vrai si `href` est un onglet : on s'y rend avec `navigate`, sans empiler un écran. */
  tab: boolean;
};

/**
 * Grille d'accès rapide de l'accueil de gestion, selon les permissions (écran 1 de la maquette :
 * Appartements, Charges, Dépense, Signalements, Annonces, Comptes). L'adjoint a la même structure
 * avec ses permissions : ni appartements, ni charges, ni dépense.
 */
export function quickActionsFor(role: Role): QuickAction[] {
  const actions: QuickAction[] = [];
  if (can(role, 'lots.write')) actions.push({ id: 'lots', domain: 'residence', href: '/lots', tab: false });
  if (canManageCharges(role)) actions.push({ id: 'charges', domain: 'charges', href: '/charges', tab: true });
  if (can(role, 'expenses.write')) actions.push({ id: 'expense', domain: 'expenses', href: '/add-expense', tab: false });
  if (can(role, 'issues.write')) actions.push({ id: 'issues', domain: 'issues', href: '/issues', tab: true });
  actions.push({ id: 'announcements', domain: 'announcements', href: '/announcements', tab: true });
  if (canSeeAccounts(role)) {
    const href = accountsHref(role);
    actions.push({ id: 'accounts', domain: 'accounts', href, tab: href === '/accounts-tab' });
  }
  return actions;
}

/**
 * Accès de l'accueil habitant : signaler un problème (tous les rôles), et les comptes pour le
 * copropriétaire (`accounts.read` : consultation seule).
 */
export function residentActionsFor(role: Role): QuickAction[] {
  const actions: QuickAction[] = [];
  if (can(role, 'issues.write')) actions.push({ id: 'report', domain: 'issues', href: '/new-issue', tab: false });
  if (canSeeAccounts(role)) actions.push({ id: 'accounts', domain: 'accounts', href: '/accounts', tab: false });
  return actions;
}

// ---------------------------------------------------------------------------------------------
// Carte « Charges de <mois> » (accueil du copropriétaire)

export type ChargesCard = {
  /** Tout est payé : état positif. */
  settled: boolean;
  /** Montant affiché : le reste à payer, ou le montant de l'appel une fois réglé. */
  centimes: number;
  /** Part déjà payée, entre 0 et 1. */
  progress: number;
  status: MyDue['status'];
};

export function chargesCardFor(due: Pick<MyDue, 'amountDue' | 'amountPaid' | 'remaining' | 'status'>): ChargesCard {
  const settled = due.remaining <= 0;
  const progress = due.amountDue > 0 ? Math.min(Math.max(due.amountPaid / due.amountDue, 0), 1) : settled ? 1 : 0;
  return { settled, centimes: settled ? due.amountDue : due.remaining, progress, status: due.status };
}

/**
 * Cartes de charges de l'accueil : seulement pour un copropriétaire. Un locataire et un gardien n'en
 * ont jamais (et ne font aucune requête, voir `myDuesResidenceId`).
 */
export const showsChargesCard = (role: Role): boolean => role === 'owner';
