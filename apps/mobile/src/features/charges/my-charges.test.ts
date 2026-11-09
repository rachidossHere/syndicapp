import { describe, expect, it } from 'vitest';

import type { MyDue, MyPayment } from '@/hooks/use-charges';

import { currentDuePerLot, dueDisplay, lastActivePayment, lotReferences } from './my-charges';

const payment = (id: string, amount: number, cancelledAt: string | null = null): MyPayment => ({
  id,
  amount,
  method: 'cash',
  paidAt: `2026-11-0${id}T10:00:00Z`,
  cancelledAt,
  receiptId: `r${id}`,
  receiptNumber: `N${id}`,
}) as MyPayment;

const due = (over: Partial<MyDue> = {}): MyDue => ({
  id: 'd1',
  chargeCallId: 'c1',
  periodLabel: '2026-Q4',
  dueDate: '2026-12-15',
  lotReference: 'A21',
  amountDue: 45000,
  amountPaid: 0,
  remaining: 45000,
  status: 'unpaid',
  payments: [],
  ...over,
});

describe('montant et statut affichés', () => {
  it('impayé : le montant restant est le montant dû', () => {
    expect(dueDisplay(due())).toEqual({ settled: false, amount: 45000, status: 'unpaid' });
  });

  it('partiel : le montant restant, pas le montant de l’appel', () => {
    expect(dueDisplay(due({ amountPaid: 20000, remaining: 25000, status: 'partial' }))).toEqual({
      settled: false,
      amount: 25000,
      status: 'partial',
    });
  });

  it('payé : reste à zéro, on affiche le montant de l’appel', () => {
    expect(dueDisplay(due({ amountPaid: 45000, remaining: 0, status: 'paid' }))).toEqual({
      settled: true,
      amount: 45000,
      status: 'paid',
    });
  });

  it('paiement annulé : le dû redevient impayé avec tout le montant restant', () => {
    const cancelled = due({ payments: [payment('1', 45000, '2026-11-02T09:00:00Z')] });
    expect(dueDisplay(cancelled)).toEqual({ settled: false, amount: 45000, status: 'unpaid' });
  });
});

describe('dernier paiement', () => {
  it('ignore les paiements annulés', () => {
    const d = due({ payments: [payment('1', 10000), payment('2', 5000, '2026-11-03T09:00:00Z')] });
    expect(lastActivePayment(d)?.id).toBe('1');
  });

  it('aucun paiement actif : undefined', () => {
    expect(lastActivePayment(due())).toBeUndefined();
    expect(lastActivePayment(due({ payments: [payment('1', 100, '2026-11-03T09:00:00Z')] }))).toBeUndefined();
  });
});

describe('appartements', () => {
  const dues = [
    due({ id: 'a', lotReference: 'A21', periodLabel: '2026-Q4' }),
    due({ id: 'b', lotReference: 'B12', periodLabel: '2026-Q4' }),
    due({ id: 'c', lotReference: 'A21', periodLabel: '2026-Q3' }),
  ];

  it('un dû courant par appartement, le plus récent', () => {
    expect(currentDuePerLot(dues).map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('références sans doublon', () => {
    expect(lotReferences(dues)).toBe('A21, B12');
  });
});
