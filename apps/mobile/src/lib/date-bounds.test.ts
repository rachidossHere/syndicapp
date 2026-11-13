import { describe, expect, it } from 'vitest';

import { DATE_USAGES, dateBoundsFor, isDateAllowed } from './date-bounds';

const TODAY = '2026-11-13';

describe('bornes des sélecteurs de date', () => {
  it('échéance des charges : aujourd’hui ou plus tard, jamais de date passée', () => {
    expect(dateBoundsFor('chargeDue', TODAY)).toEqual({ minimum: TODAY });
    expect(isDateAllowed('chargeDue', '2026-11-12', TODAY)).toBe(false);
    expect(isDateAllowed('chargeDue', '2020-01-01', TODAY)).toBe(false);
    expect(isDateAllowed('chargeDue', TODAY, TODAY)).toBe(true);
    expect(isDateAllowed('chargeDue', '2026-12-15', TODAY)).toBe(true);
    expect(isDateAllowed('chargeDue', '2030-01-01', TODAY)).toBe(true);
  });

  it('date de dépense : aujourd’hui ou plus tôt, jamais de date future', () => {
    expect(dateBoundsFor('expense', TODAY)).toEqual({ maximum: TODAY });
    expect(isDateAllowed('expense', '2026-11-14', TODAY)).toBe(false);
    expect(isDateAllowed('expense', '2030-01-01', TODAY)).toBe(false);
    expect(isDateAllowed('expense', TODAY, TODAY)).toBe(true);
    expect(isDateAllowed('expense', '2026-11-08', TODAY)).toBe(true);
    expect(isDateAllowed('expense', '2020-01-01', TODAY)).toBe(true);
  });

  it('date du solde de départ : aujourd’hui ou plus tôt, jamais de date future', () => {
    expect(dateBoundsFor('openingBalance', TODAY)).toEqual({ maximum: TODAY });
    expect(isDateAllowed('openingBalance', '2026-11-14', TODAY)).toBe(false);
    expect(isDateAllowed('openingBalance', TODAY, TODAY)).toBe(true);
    expect(isDateAllowed('openingBalance', '2026-10-01', TODAY)).toBe(true);
  });

  it('chaque usage a une seule borne : minimum pour l’échéance, maximum pour les dates passées', () => {
    for (const usage of DATE_USAGES) {
      const bounds = dateBoundsFor(usage, TODAY);
      expect(Object.keys(bounds)).toHaveLength(1);
      expect(usage === 'chargeDue' ? 'minimum' in bounds : 'maximum' in bounds).toBe(true);
    }
  });

  it('suit le jour qui change (minuit à Casablanca)', () => {
    expect(isDateAllowed('expense', '2026-11-14', '2026-11-14')).toBe(true);
    expect(isDateAllowed('chargeDue', '2026-11-13', '2026-11-14')).toBe(false);
  });
});
