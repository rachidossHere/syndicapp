import { describe, expect, it } from 'vitest';

import {
  daysInMonth,
  firstWeekdayIndex,
  isDateSelectable,
  isMonthReachable,
  monthOf,
  monthWeeks,
  shiftMonth,
} from './calendar-grid';

describe('grille du calendrier', () => {
  it('lit le mois d’une date', () => {
    expect(monthOf('2026-11-13')).toEqual({ year: 2026, month: 11 });
  });

  it('change de mois, y compris à cheval sur deux années', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 11 }, -11)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });

  it('compte les jours des mois, février bissextile compris', () => {
    expect(daysInMonth({ year: 2026, month: 11 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
  });

  it('place le 1er du mois : la semaine commence le lundi', () => {
    // Le 1er novembre 2026 est un dimanche, le 1er décembre un mardi, le 1er juin 2026 un lundi.
    expect(firstWeekdayIndex({ year: 2026, month: 11 })).toBe(6);
    expect(firstWeekdayIndex({ year: 2026, month: 12 })).toBe(1);
    expect(firstWeekdayIndex({ year: 2026, month: 6 })).toBe(0);
  });

  it('construit des semaines de 7 cases, lundi en premier', () => {
    const weeks = monthWeeks({ year: 2026, month: 11 });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // Novembre 2026 : le 1er (dimanche) est en dernière case de la 1re semaine.
    expect(weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0]![6]).toEqual({ date: '2026-11-01', day: 1 });
    expect(weeks[1]![0]).toEqual({ date: '2026-11-02', day: 2 });
    const days = weeks.flat().filter((cell) => cell !== null);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toEqual({ date: '2026-11-30', day: 30 });
  });

  it('un mois qui commence un lundi n’a pas de case vide au début', () => {
    const weeks = monthWeeks({ year: 2026, month: 6 });
    expect(weeks[0]![0]).toEqual({ date: '2026-06-01', day: 1 });
  });

  it('applique des bornes incluses, une borne absente ne limite pas', () => {
    expect(isDateSelectable('2026-11-13', '2026-11-13', undefined)).toBe(true);
    expect(isDateSelectable('2026-11-12', '2026-11-13', undefined)).toBe(false);
    expect(isDateSelectable('2026-11-13', undefined, '2026-11-13')).toBe(true);
    expect(isDateSelectable('2026-11-14', undefined, '2026-11-13')).toBe(false);
    expect(isDateSelectable('1999-01-01', undefined, undefined)).toBe(true);
  });

  it('un mois est consultable s’il contient un jour sélectionnable', () => {
    expect(isMonthReachable({ year: 2026, month: 10 }, '2026-11-13', undefined)).toBe(false);
    expect(isMonthReachable({ year: 2026, month: 11 }, '2026-11-13', undefined)).toBe(true);
    expect(isMonthReachable({ year: 2026, month: 12 }, undefined, '2026-11-13')).toBe(false);
    expect(isMonthReachable({ year: 2026, month: 11 }, undefined, '2026-11-13')).toBe(true);
  });
});
