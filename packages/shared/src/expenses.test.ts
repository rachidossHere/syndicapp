import { describe, expect, it } from 'vitest';

import {
  cancelExpenseSchema,
  createExpenseSchema,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL_KEYS,
  formatPaymentLedgerLabel,
  ledgerQuerySchema,
  setOpeningBalanceSchema,
} from './expenses';

const valid = { label: 'Plombier · fuite parking', amount: 60_000, category: 'repairs' as const };

describe('catégories', () => {
  it('ont toutes une clé de traduction', () => {
    for (const c of EXPENSE_CATEGORIES) expect(EXPENSE_CATEGORY_LABEL_KEYS[c]).toBe(`expenses.category.${c}`);
    expect(EXPENSE_CATEGORIES).toHaveLength(8);
  });
});

describe('createExpenseSchema', () => {
  it('accepte une dépense minimale', () => {
    expect(createExpenseSchema.safeParse(valid).success).toBe(true);
  });
  it.each([0, -1, 1.5, 1_000_000_001])('refuse le montant %s', (amount) => {
    expect(createExpenseSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });
  it('refuse un libellé vide, une catégorie inconnue, un champ en trop', () => {
    expect(createExpenseSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...valid, category: 'plomberie' }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...valid, recordedBy: 'x' }).success).toBe(false);
  });
  it('refuse une date inexistante et une facture trop lourde ou d’un mauvais type', () => {
    expect(createExpenseSchema.safeParse({ ...valid, spentOn: '2026-02-31' }).success).toBe(false);
    const invoice = { key: 'k', contentType: 'image/jpeg', size: 1000 };
    expect(createExpenseSchema.safeParse({ ...valid, invoice }).success).toBe(true);
    expect(
      createExpenseSchema.safeParse({ ...valid, invoice: { ...invoice, size: 15 * 1024 * 1024 } })
        .success,
    ).toBe(false);
    expect(
      createExpenseSchema.safeParse({ ...valid, invoice: { ...invoice, contentType: 'application/x-msdownload' } })
        .success,
    ).toBe(false);
  });
  it('exige un client_id valide quand il est fourni', () => {
    expect(createExpenseSchema.safeParse({ ...valid, clientId: 'abc' }).success).toBe(false);
    expect(
      createExpenseSchema.safeParse({ ...valid, clientId: '3f1c2b9e-5d1a-4b8e-9c3a-7a1d2e4f5a6b' })
        .success,
    ).toBe(true);
  });
});

describe('cancelExpenseSchema', () => {
  it('exige un motif non vide', () => {
    expect(cancelExpenseSchema.safeParse({}).success).toBe(false);
    expect(cancelExpenseSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(cancelExpenseSchema.safeParse({ reason: 'Doublon' }).success).toBe(true);
  });
});

describe('setOpeningBalanceSchema', () => {
  it('accepte 0 et un montant entier, refuse un négatif ou un décimal', () => {
    const date = '2026-10-01';
    expect(setOpeningBalanceSchema.safeParse({ amount: 0, asOfDate: date }).success).toBe(true);
    expect(setOpeningBalanceSchema.safeParse({ amount: 540_000, asOfDate: date }).success).toBe(true);
    expect(setOpeningBalanceSchema.safeParse({ amount: -1, asOfDate: date }).success).toBe(false);
    expect(setOpeningBalanceSchema.safeParse({ amount: 10.5, asOfDate: date }).success).toBe(false);
  });
});

describe('ledgerQuerySchema', () => {
  it('applique la pagination par défaut et refuse une période inversée', () => {
    expect(ledgerQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
    expect(ledgerQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }).success).toBe(false);
    expect(ledgerQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('formatPaymentLedgerLabel', () => {
  it('donne « Charge reçue · B12 »', () => {
    expect(formatPaymentLedgerLabel('B12')).toBe('Charge reçue · B12');
  });
});
