import { describe, expect, it } from 'vitest';

import {
  casablancaDate,
  defaultDueDate,
  formatMadInput,
  parseMadInput,
  parsePeriod,
  periodOf,
  upcomingPeriods,
} from './charges-format';

describe('périodes', () => {
  it('lit les libellés trimestriels et mensuels', () => {
    expect(parsePeriod('2026-Q4')).toEqual({ kind: 'quarter', year: 2026, quarter: 4 });
    expect(parsePeriod('2026-11')).toEqual({ kind: 'month', year: 2026, month: 11 });
    expect(parsePeriod('2026-M11')).toBeUndefined();
    expect(parsePeriod('2026-13')).toBeUndefined();
  });

  it('période en cours et suivantes, avec passage à l’année suivante', () => {
    expect(periodOf('quarterly', '2026-11-08')).toBe('2026-Q4');
    expect(periodOf('monthly', '2026-11-08')).toBe('2026-11');
    expect(upcomingPeriods('quarterly', '2026-11-08', 3)).toEqual(['2026-Q4', '2027-Q1', '2027-Q2']);
    expect(upcomingPeriods('monthly', '2026-11-08', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('échéance proposée : le 15 du dernier mois, jamais dans le passé', () => {
    expect(defaultDueDate('2026-Q4', '2026-11-08')).toBe('2026-12-15');
    expect(defaultDueDate('2026-11', '2026-11-08')).toBe('2026-11-15');
    expect(defaultDueDate('2026-11', '2026-11-20')).toBe('2026-11-20');
  });
});

describe('dates à Casablanca', () => {
  it('23 h 30 UTC le 31 décembre : déjà le 1er janvier à Casablanca', () => {
    expect(casablancaDate('2026-12-31T23:30:00Z')).toBe('2027-01-01');
    expect(casablancaDate('2026-11-05T10:00:00Z')).toBe('2026-11-05');
  });
});

describe('saisie des montants', () => {
  it('dirhams → centimes entiers', () => {
    expect(parseMadInput('450')).toBe(45_000);
    expect(parseMadInput('450,5')).toBe(45_050);
    expect(parseMadInput('1 200.50')).toBe(120_050);
    expect(parseMadInput(' 200 ')).toBe(20_000);
  });

  it('refuse vide, zéro, négatif, trois décimales, lettres', () => {
    for (const text of ['', '0', '0,00', '-5', '4,505', 'abc', '45O']) {
      expect(parseMadInput(text)).toBeUndefined();
    }
  });

  it('pré-remplissage', () => {
    expect(formatMadInput(45_000)).toBe('450');
    expect(formatMadInput(25_050)).toBe('250,50');
  });
});
