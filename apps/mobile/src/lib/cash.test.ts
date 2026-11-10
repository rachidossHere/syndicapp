import { ROLES, type Role } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import {
  accountsResidenceId,
  canCancelExpense,
  canSeeAccounts,
  canSetOpeningBalance,
  fileSize,
  ledgerView,
  ltrIsolate,
  openingBalanceResidenceId,
  parseOpeningAmount,
  validateCancelReason,
  validateOpeningBalance,
  type LedgerEntry,
} from './cash';

const entry = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
  kind: 'expense',
  id: 'x',
  date: '2026-11-08',
  direction: 'out',
  amount: 60000,
  label: 'Plombier · fuite parking',
  lotReference: null,
  category: 'repairs',
  hasInvoice: true,
  cancelled: false,
  cancelledAt: null,
  cancelReason: null,
  ...overrides,
});

describe('accès aux comptes selon le rôle', () => {
  it('syndic, trésorier, adjoint et copropriétaire voient « Comptes » ; locataire et gardien non', () => {
    expect(ROLES.filter((role) => canSeeAccounts(role))).toEqual(['manager', 'treasurer', 'deputy', 'owner']);
  });

  it.each<Role>(['manager', 'treasurer', 'deputy', 'owner'])('%s : la requête vise sa résidence', (role) => {
    expect(accountsResidenceId({ id: 'res-1', role })).toBe('res-1');
  });

  it.each<Role>(['tenant', 'caretaker'])(
    '%s : requête désactivée, aucun appel à /api/cash ni /api/expenses',
    (role) => {
      expect(accountsResidenceId({ id: 'res-1', role })).toBeUndefined();
    },
  );

  it('sans résidence active : requête désactivée', () => {
    expect(accountsResidenceId(null)).toBeUndefined();
    expect(accountsResidenceId(undefined)).toBeUndefined();
  });

  it('seuls le syndic et le trésorier peuvent annuler une dépense ; le copropriétaire ne peut rien annuler', () => {
    expect(ROLES.filter((role) => canCancelExpense(role))).toEqual(['manager', 'treasurer']);
    expect(canCancelExpense('owner')).toBe(false);
  });

  it('seul le syndic accède au solde de départ (pas de requête pour les autres)', () => {
    expect(ROLES.filter((role) => canSetOpeningBalance(role))).toEqual(['manager']);
    expect(openingBalanceResidenceId({ id: 'res-1', role: 'manager' })).toBe('res-1');
    for (const role of ROLES.filter((r) => r !== 'manager')) {
      expect(openingBalanceResidenceId({ id: 'res-1', role })).toBeUndefined();
    }
  });
});

describe('présentation d’un mouvement', () => {
  it('une entrée (paiement) : « + », sens « in », pas de badge, non cliquable', () => {
    const view = ledgerView(entry({ kind: 'payment', direction: 'in', hasInvoice: false, lotReference: 'A21' }));
    expect(view).toEqual({ direction: 'in', sign: '+', noInvoice: false, cancelled: false, opensDetail: false });
  });

  it('une sortie (dépense) : « − », sens « out », cliquable', () => {
    const view = ledgerView(entry({}));
    expect(view).toEqual({ direction: 'out', sign: '−', noInvoice: false, cancelled: false, opensDetail: true });
  });

  it('une dépense sans facture porte le badge « Sans facture »', () => {
    expect(ledgerView(entry({ hasInvoice: false })).noInvoice).toBe(true);
  });

  it('un paiement n’a jamais le badge « Sans facture »', () => {
    expect(ledgerView(entry({ kind: 'payment', direction: 'in', hasInvoice: false })).noInvoice).toBe(false);
  });

  it('une dépense annulée porte le badge « Annulée »', () => {
    expect(ledgerView(entry({ cancelled: true })).cancelled).toBe(true);
    expect(ledgerView(entry({ cancelled: true, kind: 'payment', direction: 'in' })).cancelled).toBe(true);
  });
});

describe('petits formats', () => {
  it('la référence d’appartement est isolée de gauche à droite', () => {
    expect(ltrIsolate('A21')).toBe('⁦A21⁩');
  });

  it('taille d’une facture : Ko ou Mo', () => {
    expect(fileSize(412 * 1024)).toEqual({ value: '412', unit: 'kb' });
    expect(fileSize(10)).toEqual({ value: '1', unit: 'kb' });
    expect(fileSize(1.25 * 1024 * 1024)).toEqual({ value: '1,3', unit: 'mb' });
  });
});

describe('annulation d’une dépense', () => {
  it('le motif est obligatoire : vide ou espaces refusés', () => {
    for (const reason of ['', '   ', '\n']) {
      expect(validateCancelReason(reason)).toEqual({ ok: false, errorKey: 'expenses.errors.cancelReasonRequired' });
    }
  });

  it('un motif valide est rogné', () => {
    expect(validateCancelReason('  Saisie en double ')).toEqual({ ok: true, reason: 'Saisie en double' });
  });
});

describe('solde de départ', () => {
  const today = '2026-11-10';

  it('montant : 0 est permis (caisse vide), les montants invalides sont refusés', () => {
    expect(parseOpeningAmount('0')).toBe(0);
    expect(parseOpeningAmount('0,00')).toBe(0);
    expect(parseOpeningAmount('5 400')).toBe(540000);
    expect(parseOpeningAmount('450,5')).toBe(45050);
    for (const bad of ['', 'abc', '-5', '1,234']) expect(parseOpeningAmount(bad)).toBeUndefined();
  });

  it('première saisie : aucun motif demandé, et aucun motif envoyé', () => {
    const result = validateOpeningBalance({ amount: '5400', asOfDate: '2026-10-01', reason: '' }, false);
    expect(result).toEqual({ ok: true, input: { amount: 540000, asOfDate: '2026-10-01' } });
    const ignored = validateOpeningBalance({ amount: '5400', asOfDate: '2026-10-01', reason: 'inutile' }, false);
    expect(ignored).toEqual({ ok: true, input: { amount: 540000, asOfDate: '2026-10-01' } });
  });

  it('correction : le motif est obligatoire (vide ou espaces refusés)', () => {
    for (const reason of ['', '   ']) {
      const result = validateOpeningBalance({ amount: '5500', asOfDate: '2026-10-01', reason }, true);
      expect(result).toEqual({ ok: false, errors: { reason: 'expenses.errors.openingReasonRequired' } });
    }
  });

  it('correction avec motif : acceptée, le motif est rogné', () => {
    const result = validateOpeningBalance({ amount: '5500', asOfDate: '2026-10-01', reason: ' Oubli d’un reçu ' }, true);
    expect(result).toEqual({
      ok: true,
      input: { amount: 550000, asOfDate: '2026-10-01', reason: 'Oubli d’un reçu' },
    });
  });

  it('montant et date invalides : erreurs par champ', () => {
    const result = validateOpeningBalance({ amount: 'abc', asOfDate: 'demain', reason: '' }, false);
    expect(result).toEqual({
      ok: false,
      errors: { amount: 'expenses.errors.amountInvalid', asOfDate: 'expenses.errors.dateInvalid' },
    });
    expect(today).toBeTruthy();
  });
});
