import { PAYMENT_METHOD_LABEL_KEYS, type PaymentMethod } from '@syndic/shared';
import { useCallback, useMemo } from 'react';

import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { casablancaDate, dateParts, parsePeriod } from '@/lib/charges-format';

// Clés construites à partir d'un numéro : leur existence en français et en arabe est vérifiée
// par les tests de traduction (et le typage de ar.ts exige les mêmes clés que fr.ts).
const key = (value: string) => value as TranslationKey;

/** Libellés des périodes, dates et modes de paiement, dans la langue active. */
export function useChargeFormat() {
  const t = useT();

  /** « 4e trimestre 2026 », « Novembre 2026 » ; « الربع الرابع 2026 », « نونبر 2026 ». */
  const period = useCallback(
    (label: string) => {
      const parsed = parsePeriod(label);
      if (!parsed) return label;
      return parsed.kind === 'quarter'
        ? t(key(`charges.period.quarter${parsed.quarter}`), { year: parsed.year })
        : t('charges.period.month', { month: t(key(`charges.months.${parsed.month}`)), year: parsed.year });
    },
    [t],
  );

  /** Repère court d'une période : « T4 » (« ر4 »), ou le mois abrégé. */
  const shortPeriod = useCallback(
    (label: string) => {
      const parsed = parsePeriod(label);
      if (!parsed) return label;
      return parsed.kind === 'quarter'
        ? t('charges.period.shortQuarter', { quarter: parsed.quarter })
        : t(key(`charges.dateMonthsShort.${parsed.month}`));
    },
    [t],
  );

  /** Date AAAA-MM-JJ : « 15 déc. » (court) ou « 15 décembre 2026 » (long). */
  const date = useCallback(
    (value: string, variant: 'short' | 'long' = 'short') => {
      const { year, month, day } = dateParts(value);
      return variant === 'short'
        ? t('charges.date.short', { day, month: t(key(`charges.dateMonthsShort.${month}`)) })
        : t('charges.date.long', { day, month: t(key(`charges.dateMonths.${month}`)), year });
    },
    [t],
  );

  /** Date d'un instant (ISO), dans le fuseau Africa/Casablanca. */
  const instant = useCallback(
    (iso: string, variant: 'short' | 'long' = 'short') => date(casablancaDate(iso), variant),
    [date],
  );

  const method = useCallback(
    (value: PaymentMethod) => t(key(PAYMENT_METHOD_LABEL_KEYS[value])),
    [t],
  );

  return useMemo(() => ({ period, shortPeriod, date, instant, method }), [period, shortPeriod, date, instant, method]);
}
