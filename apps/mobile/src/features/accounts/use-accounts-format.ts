import { EXPENSE_CATEGORY_LABEL_KEYS, type ExpenseCategory, type Role } from '@syndic/shared';
import { useCallback, useMemo } from 'react';

import { useChargeFormat } from '@/features/charges/use-charge-format';
import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { fileSize, isPdf, ltrIsolate, type LedgerEntry } from '@/lib/cash';

// Clés construites à partir d'identifiants fermés (catégories, rôles) : leur existence en FR et
// en AR est vérifiée par le typage de ar.ts et par les tests de traduction.
const key = (value: string) => value as TranslationKey;

/** Libellés des comptes (catégories, auteurs, tailles, lignes du journal) dans la langue active. */
export function useAccountsFormat() {
  const t = useT();
  const format = useChargeFormat();

  const category = useCallback(
    (value: string | null) =>
      value !== null && value in EXPENSE_CATEGORY_LABEL_KEYS
        ? t(key(EXPENSE_CATEGORY_LABEL_KEYS[value as ExpenseCategory]))
        : t('expenses.category.other'),
    [t],
  );

  /** Titre d'un mouvement : « Charge reçue · A21 » (référence de gauche à droite) ou le libellé saisi. */
  const entryTitle = useCallback(
    (entry: LedgerEntry) =>
      entry.kind === 'payment'
        ? t('accounts.ledger.paymentReceived', { lot: ltrIsolate(entry.lotReference ?? '') })
        : entry.label,
    [t],
  );

  /** Sous-titre : « Réparations · 8 nov. · facture » ou « Encaissement · 8 nov. ». */
  const entryLine = useCallback(
    (entry: LedgerEntry) => {
      const date = format.date(entry.date);
      if (entry.kind === 'payment') return t('accounts.ledger.paymentLine', { date });
      return t(entry.hasInvoice ? 'accounts.ledger.expenseLineInvoice' : 'accounts.ledger.expenseLine', {
        category: category(entry.category),
        date,
      });
    },
    [t, format, category],
  );

  /** « Le syndic », « Le trésorier » : jamais le nom de la personne. */
  const author = useCallback(
    (role: Role | null) =>
      t(role === 'manager' ? 'accounts.by.manager' : role === 'treasurer' ? 'accounts.by.treasurer' : 'accounts.by.other'),
    [t],
  );

  /** « 412 Ko », « 1,2 Mo ». */
  const size = useCallback(
    (bytes: number) => {
      const { value, unit } = fileSize(bytes);
      return t(unit === 'kb' ? 'accounts.size.kb' : 'accounts.size.mb', { value });
    },
    [t],
  );

  /** « Photo · 412 Ko » ou « PDF · 1,2 Mo ». */
  const invoiceLine = useCallback(
    (contentType: string | null, bytes: number | null) => {
      const sizeText = bytes === null ? '' : size(bytes);
      return t(isPdf(contentType) ? 'accounts.invoice.pdf' : 'accounts.invoice.photo', { size: sizeText });
    },
    [t, size],
  );

  return useMemo(
    () => ({ category, entryTitle, entryLine, author, size, invoiceLine }),
    [category, entryTitle, entryLine, author, size, invoiceLine],
  );
}
