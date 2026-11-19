import { ROLES, type Role } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import type { LedgerEntry } from './cash';
import {
  SPARKLINE_MAX_ENTRIES,
  attentionItems,
  attentionKey,
  balanceSeries,
  chargesCardFor,
  firstName,
  homeKindFor,
  quickActionsFor,
  residentActionsFor,
  seesIssuesToHandle,
  seesUnpaid,
  showsCashCard,
  showsChargesCard,
  todayParts,
  unpaidHref,
  unpaidTotal,
} from './home';

const call = (id: string, unpaidCount: number, partialCount = 0) => ({ id, unpaidCount, partialCount });
const entry = (direction: 'in' | 'out', amount: number, cancelled = false): LedgerEntry => ({
  kind: direction === 'in' ? 'payment' : 'expense',
  id: `${direction}-${amount}`,
  date: '2026-11-10',
  direction,
  amount,
  label: '',
  lotReference: null,
  category: null,
  hasInvoice: false,
  cancelled,
  cancelledAt: null,
  cancelReason: null,
});

describe('type d’accueil selon le rôle', () => {
  it('syndic, trésorier et adjoint : accueil de gestion ; les autres : accueil de l’habitant', () => {
    for (const role of ['manager', 'treasurer', 'deputy'] as const) expect(homeKindFor(role), role).toBe('staff');
    for (const role of ['owner', 'tenant', 'caretaker'] as const) expect(homeKindFor(role), role).toBe('resident');
  });

  it('la carte du solde n’existe que pour la gestion (accounts.read)', () => {
    for (const role of ROLES) expect(showsCashCard(role), role).toBe(['manager', 'treasurer', 'deputy'].includes(role));
  });

  it('la carte des charges n’existe que pour le copropriétaire (jamais locataire ni gardien)', () => {
    for (const role of ROLES) expect(showsChargesCard(role), role).toBe(role === 'owner');
  });
});

describe('salutation', () => {
  it('prénom : premier mot du nom', () => {
    expect(firstName('Rachid Halif')).toBe('Rachid');
    expect(firstName('  Karim ')).toBe('Karim');
  });

  it('date à Casablanca : mercredi 18 novembre 2026', () => {
    expect(todayParts(new Date('2026-11-18T10:00:00Z'))).toEqual({ weekday: 3, day: 18, month: 11 });
  });

  it('un dimanche vaut 7 et un lundi 1', () => {
    expect(todayParts(new Date('2026-11-22T10:00:00Z')).weekday).toBe(7);
    expect(todayParts(new Date('2026-11-23T10:00:00Z')).weekday).toBe(1);
  });

  it('passé minuit à Casablanca, le jour suivant s’affiche', () => {
    // 23 h 30 UTC = 0 h 30 à Casablanca (UTC+1 en novembre 2026) : déjà jeudi 19.
    expect(todayParts(new Date('2026-11-18T23:30:00Z'))).toMatchObject({ weekday: 4, day: 19 });
  });
});

describe('carte « Solde de la caisse » : courbe', () => {
  it('retrouve les soldes successifs à rebours, du plus ancien au plus récent', () => {
    // Solde actuel 1000 ; mouvements du plus récent au plus ancien : +300 puis −100.
    expect(balanceSeries(1000, [entry('in', 300), entry('out', 100)])).toEqual([800, 700, 1000]);
  });

  it('un mouvement annulé ne compte pas (le solde de l’API l’exclut aussi)', () => {
    expect(balanceSeries(1000, [entry('in', 300, true), entry('out', 100)])).toEqual([1100, 1000]);
  });

  it('sans mouvement, un seul point : pas de courbe (moins de 3 points)', () => {
    expect(balanceSeries(500, [])).toEqual([500]);
  });

  it('n’utilise que les derniers mouvements', () => {
    const many = Array.from({ length: 40 }, () => entry('in', 10));
    expect(balanceSeries(1000, many)).toHaveLength(SPARKLINE_MAX_ENTRIES + 1);
  });
});

describe('pastilles « À traiter »', () => {
  const counts = (urgent: number, open = 0, inProgress = 0) => ({ open, in_progress: inProgress, urgentUnresolved: urgent });

  it('impayés : impayés et partiels de tous les appels', () => {
    expect(unpaidTotal([call('a', 2, 1), call('b', 0, 0), call('c', 3)])).toBe(6);
  });

  it('sont cachées quand le nombre est 0', () => {
    expect(attentionItems('manager', { calls: [call('a', 0, 0)], counts: counts(0) })).toEqual([]);
    expect(attentionItems('manager', { calls: [], counts: counts(0, 5, 2) })).toEqual([]);
  });

  it('sont cachées tant que les nombres ne sont pas connus (chargement ou erreur)', () => {
    expect(attentionItems('manager', { calls: undefined, counts: undefined })).toEqual([]);
  });

  it('syndic : « 3 impayés » et « 1 signalement urgent », dans cet ordre', () => {
    const items = attentionItems('manager', { calls: [call('a', 2, 1)], counts: counts(1) });
    expect(items.map((item) => [item.kind, item.count])).toEqual([
      ['unpaid', 3],
      ['urgent', 1],
    ]);
  });

  it('impayés : un seul appel concerné ouvre l’écran des impayés, sinon l’onglet Charges', () => {
    expect(unpaidHref('manager', [call('a', 2), call('b', 0)])).toEqual({ pathname: '/unpaid/[id]', params: { id: 'a' } });
    expect(unpaidHref('manager', [call('a', 2), call('b', 1)])).toEqual({ pathname: '/charges' });
    expect(unpaidHref('manager', [])).toEqual({ pathname: '/charges' });
  });

  it('le trésorier (qui ne peut pas relancer) est envoyé sur l’onglet Charges', () => {
    expect(unpaidHref('treasurer', [call('a', 2)])).toEqual({ pathname: '/charges' });
  });

  it('les urgents ouvrent la liste des signalements filtrée sur les urgents', () => {
    const [item] = attentionItems('deputy', { calls: undefined, counts: counts(2) });
    expect(item).toEqual({ kind: 'urgent', count: 2, href: { pathname: '/issues', params: { filter: 'urgent' } } });
  });

  it('adjoint : impayés (accounts.read) et urgents (issues.manage) ; les impayés ouvrent l’onglet Comptes', () => {
    const items = attentionItems('deputy', { calls: [call('a', 4)], counts: counts(1) });
    expect(items.map((item) => [item.kind, item.count])).toEqual([
      ['unpaid', 4],
      ['urgent', 1],
    ]);
    expect(items[0]!.href).toEqual({ pathname: '/accounts-tab' });
  });

  it('gardien : ses signalements ouverts à traiter et les urgents, jamais d’impayés', () => {
    const items = attentionItems('caretaker', { calls: [call('a', 9)], counts: counts(1, 4, 3) });
    expect(items.map((item) => [item.kind, item.count])).toEqual([
      ['toHandle', 4],
      ['urgent', 1],
    ]);
    expect(items[0]!.href).toEqual({ pathname: '/issues', params: { filter: 'open' } });
  });

  it('copropriétaire, locataire, trésorier : aucune pastille de signalements', () => {
    for (const role of ['owner', 'tenant', 'treasurer'] as const) {
      expect(attentionItems(role, { calls: undefined, counts: counts(3, 3, 3) }), role).toEqual([]);
    }
  });

  it('qui voit quoi : impayés pour la gestion avec accounts.read, signalements pour issues.manage', () => {
    const unpaid = ROLES.filter(seesUnpaid);
    expect(unpaid).toEqual(['manager', 'treasurer', 'deputy']);
    const issues = ROLES.filter(seesIssuesToHandle);
    expect(issues).toEqual(['manager', 'deputy', 'caretaker']);
  });

  it('libellé au singulier pour 1, au pluriel sinon', () => {
    expect(attentionKey('unpaid', 1)).toBe('home.attention.unpaid.one');
    expect(attentionKey('unpaid', 3)).toBe('home.attention.unpaid.other');
    expect(attentionKey('urgent', 1)).toBe('home.attention.urgent.one');
    expect(attentionKey('toHandle', 2)).toBe('home.attention.toHandle.other');
  });
});

describe('accès rapide selon les permissions', () => {
  const ids = (role: Role) => quickActionsFor(role).map((action) => action.id);

  it('syndic : Appartements, Charges, Dépense, Signalements, Annonces, Comptes', () => {
    expect(ids('manager')).toEqual(['lots', 'charges', 'expense', 'issues', 'announcements', 'accounts']);
  });

  it('trésorier : Charges, Dépense, Signalements, Annonces, Comptes (pas d’appartements)', () => {
    expect(ids('treasurer')).toEqual(['charges', 'expense', 'issues', 'announcements', 'accounts']);
  });

  it('adjoint : Signalements, Annonces, Comptes seulement (même structure, ses permissions)', () => {
    expect(ids('deputy')).toEqual(['issues', 'announcements', 'accounts']);
  });

  it('les comptes s’ouvrent en onglet pour l’adjoint, au-dessus des onglets pour les autres', () => {
    const accounts = (role: Role) => quickActionsFor(role).find((action) => action.id === 'accounts')!;
    expect(accounts('deputy')).toMatchObject({ href: '/accounts-tab', tab: true });
    expect(accounts('manager')).toMatchObject({ href: '/accounts', tab: false });
  });

  it('Charges, Signalements et Annonces sont des onglets ; Appartements et Dépense s’ouvrent au-dessus', () => {
    const actions = quickActionsFor('manager');
    const tab = (id: string) => actions.find((action) => action.id === id)!.tab;
    expect([tab('charges'), tab('issues'), tab('announcements')]).toEqual([true, true, true]);
    expect([tab('lots'), tab('expense')]).toEqual([false, false]);
  });

  it('habitant : signaler un problème pour tous, les comptes en consultation pour le copropriétaire', () => {
    expect(residentActionsFor('owner').map((action) => action.id)).toEqual(['report', 'accounts']);
    expect(residentActionsFor('tenant').map((action) => action.id)).toEqual(['report']);
    expect(residentActionsFor('caretaker').map((action) => action.id)).toEqual(['report']);
  });

  it('aucun accès aux comptes pour un locataire ou un gardien', () => {
    for (const role of ['tenant', 'caretaker'] as const) {
      expect(ids(role)).not.toContain('accounts');
      expect(residentActionsFor(role).map((action) => action.id)).not.toContain('accounts');
    }
  });
});

describe('carte « Charges de <période> » selon le statut', () => {
  it('impayé : le reste à payer, progression nulle', () => {
    expect(chargesCardFor({ amountDue: 45000, amountPaid: 0, remaining: 45000, status: 'unpaid' })).toEqual({
      settled: false,
      centimes: 45000,
      progress: 0,
      status: 'unpaid',
    });
  });

  it('partiel : le reste à payer et la part payée', () => {
    const card = chargesCardFor({ amountDue: 40000, amountPaid: 10000, remaining: 30000, status: 'partial' });
    expect(card).toMatchObject({ settled: false, centimes: 30000, progress: 0.25, status: 'partial' });
  });

  it('payé : état positif, montant de l’appel, barre pleine', () => {
    const card = chargesCardFor({ amountDue: 45000, amountPaid: 45000, remaining: 0, status: 'paid' });
    expect(card).toEqual({ settled: true, centimes: 45000, progress: 1, status: 'paid' });
  });

  it('la progression reste entre 0 et 1', () => {
    expect(chargesCardFor({ amountDue: 100, amountPaid: 150, remaining: 0, status: 'paid' }).progress).toBe(1);
    expect(chargesCardFor({ amountDue: 0, amountPaid: 0, remaining: 0, status: 'paid' }).progress).toBe(1);
  });
});
