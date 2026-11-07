import { describe, expect, it } from 'vitest';

import {
  CHARGE_ERRORS,
  CHARGE_PERIODS,
  DUE_STATUSES,
  DUE_STATUS_LABEL_KEYS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL_KEYS,
  cancelPaymentSchema,
  computeDueStatus,
  createChargeCallSchema,
  createPaymentSchema,
  isPeriodLabelFor,
  periodLabelOf,
  todayInCasablanca,
  updateResidenceSettingsSchema,
} from './charges';

const uuid = '0b8f3a52-6c1e-4f0e-9d3a-7a6c2f1b9e10';

describe('constantes des charges', () => {
  it('valeurs en anglais, une clé de traduction par valeur', () => {
    expect(DUE_STATUSES).toEqual(['paid', 'partial', 'unpaid']);
    expect(PAYMENT_METHODS).toEqual(['cash', 'transfer']);
    expect(CHARGE_PERIODS).toEqual(['monthly', 'quarterly']);
    for (const status of DUE_STATUSES) expect(DUE_STATUS_LABEL_KEYS[status]).toMatch(/^charges\./);
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABEL_KEYS[method]).toMatch(/^charges\./);
    }
  });
});

describe('createChargeCallSchema', () => {
  const valid = { periodLabel: '2026-Q4', amountPerLot: 45_000, dueDate: '2026-12-15' };

  it('accepte un appel valide', () => {
    expect(createChargeCallSchema.safeParse(valid).success).toBe(true);
    expect(createChargeCallSchema.safeParse({ ...valid, periodLabel: '2026-11' }).success).toBe(true);
  });

  it('refuse un montant nul, négatif ou à virgule', () => {
    for (const amountPerLot of [0, -1, 450.5]) {
      expect(createChargeCallSchema.safeParse({ ...valid, amountPerLot }).success).toBe(false);
    }
  });

  it('refuse une période ou une date invalide', () => {
    for (const periodLabel of ['2026-Q5', '2026-13', '2026-00', '2026-M11', '2026', 'T4 2026']) {
      expect(createChargeCallSchema.safeParse({ ...valid, periodLabel }).success).toBe(false);
    }
    for (const dueDate of ['2026-02-31', '15/12/2026', '2026-12-15T00:00:00Z']) {
      expect(createChargeCallSchema.safeParse({ ...valid, dueDate }).success).toBe(false);
    }
  });

  it('refuse un champ inconnu (residence_id vient de l\'en-tête, pas du corps)', () => {
    expect(createChargeCallSchema.safeParse({ ...valid, residenceId: uuid }).success).toBe(false);
  });
});

describe('createPaymentSchema', () => {
  it('accepte espèces et virement, refuse le reste', () => {
    for (const method of PAYMENT_METHODS) {
      expect(createPaymentSchema.safeParse({ chargeDueId: uuid, amount: 45_000, method }).success).toBe(true);
    }
    expect(createPaymentSchema.safeParse({ chargeDueId: uuid, amount: 45_000, method: 'especes' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ chargeDueId: 'abc', amount: 45_000, method: 'cash' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ chargeDueId: uuid, amount: 0, method: 'cash' }).success).toBe(false);
  });
});

describe('cancelPaymentSchema', () => {
  it('exige un motif non vide', () => {
    expect(cancelPaymentSchema.safeParse({ reason: 'Erreur de lot' }).success).toBe(true);
    expect(cancelPaymentSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(cancelPaymentSchema.safeParse({}).success).toBe(false);
  });
});

describe('périodes', () => {
  it('le libellé doit correspondre à la périodicité de la résidence', () => {
    expect(isPeriodLabelFor('quarterly', '2026-Q4')).toBe(true);
    expect(isPeriodLabelFor('quarterly', '2026-11')).toBe(false);
    expect(isPeriodLabelFor('monthly', '2026-11')).toBe(true);
    expect(isPeriodLabelFor('monthly', '2026-Q4')).toBe(false);
  });

  it('période en cours à partir d\'une date', () => {
    expect(periodLabelOf('quarterly', '2026-11-07')).toBe('2026-Q4');
    expect(periodLabelOf('quarterly', '2026-01-01')).toBe('2026-Q1');
    expect(periodLabelOf('quarterly', '2026-06-30')).toBe('2026-Q2');
    expect(periodLabelOf('monthly', '2026-03-31')).toBe('2026-03');
  });

  it('date du jour dans le fuseau Africa/Casablanca', () => {
    // 31 décembre 2026 à 23 h 30 UTC : déjà le 1er janvier 2027 à Casablanca (UTC+1).
    expect(todayInCasablanca(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(todayInCasablanca(new Date('2026-11-07T10:00:00Z'))).toBe('2026-11-07');
  });
});

describe('updateResidenceSettingsSchema', () => {
  it('accepte monthly et quarterly, refuse le reste', () => {
    expect(updateResidenceSettingsSchema.safeParse({ chargePeriod: 'monthly' }).success).toBe(true);
    expect(updateResidenceSettingsSchema.safeParse({ chargePeriod: 'yearly' }).success).toBe(false);
    expect(updateResidenceSettingsSchema.safeParse({}).success).toBe(false);
  });
});

describe('clés d\'erreur', () => {
  it('toutes sous charges.errors.*', () => {
    for (const key of Object.values(CHARGE_ERRORS)) expect(key).toMatch(/^charges\.errors\.\w+$/);
  });
});

describe('computeDueStatus', () => {
  it('450 MAD sur 450 → paid, 200 → partial, 0 → unpaid', () => {
    expect(computeDueStatus(45_000, 45_000)).toBe('paid');
    expect(computeDueStatus(20_000, 45_000)).toBe('partial');
    expect(computeDueStatus(0, 45_000)).toBe('unpaid');
  });
});
