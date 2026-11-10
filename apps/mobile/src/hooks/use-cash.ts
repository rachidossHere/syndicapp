// Comptes (plan 06, étape 4) : solde, journal, détail d'une dépense, facture, solde de départ.
// Tout ce qui dépend de la caisse partage la clé `cashQueryKey` / `expensesQueryKey` : une
// annulation ou un changement du solde de départ les rafraîchit ensemble.
import type { ExpenseCategory, Role, SetOpeningBalanceInput } from '@syndic/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { apiFetch } from '@/lib/api';
import { INVOICE_URL_MAX_CACHE_MS, type LedgerEntry } from '@/lib/cash';

import { cashQueryKey, expensesQueryKey } from './use-expenses';

/** Taille d'une page du journal. */
export const LEDGER_PAGE_SIZE = 20;

/** Réponse de GET /api/cash : solde, période en cours et une page du journal. */
export type CashPage = {
  balance: number;
  openingBalance: number;
  /** Nul tant que le syndic n'a rien saisi. */
  openingBalanceDate: string | null;
  period: { label: string; from: string; to: string; collected: number; spent: number };
  ledger: { items: LedgerEntry[]; total: number; limit: number; offset: number };
};

/** Solde, encaissé et dépensé, puis journal chargé par pages (`fetchNextPage` au défilement). */
export function useCash(residenceId: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...cashQueryKey(residenceId ?? 'none'), 'ledger'],
    queryFn: ({ pageParam }) =>
      apiFetch<CashPage>(`/api/cash?limit=${LEDGER_PAGE_SIZE}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.ledger.offset + last.ledger.items.length;
      return last.ledger.items.length > 0 && next < last.ledger.total ? next : undefined;
    },
    enabled: residenceId !== undefined,
  });
}

/** Détail d'une dépense (GET /api/expenses/:id) : le rôle de l'auteur, jamais son nom. */
export type ExpenseDetail = {
  id: string;
  label: string;
  amount: number;
  category: ExpenseCategory;
  spentOn: string;
  supplier: string | null;
  hasInvoice: boolean;
  invoiceContentType: string | null;
  invoiceSize: number | null;
  createdAt: string;
  cancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  recordedByRole: Role | null;
  cancelledByRole: Role | null;
};

export function useExpense(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: [...expensesQueryKey(residenceId ?? 'none'), 'detail', id ?? 'none'],
    queryFn: () => apiFetch<ExpenseDetail>(`/api/expenses/${encodeURIComponent(id ?? '')}`),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

type InvoiceUrl = { url: string; expiresIn: number; filename: string; contentType: string };
const invoiceUrl = (id: string) =>
  apiFetch<InvoiceUrl>(`/api/expenses/${encodeURIComponent(id)}/invoice-url`);

/**
 * URL signée de l'aperçu d'une image. Elle vit 5 minutes côté R2 : elle n'est jamais gardée en
 * cache plus de 4 minutes (`gcTime`), et considérée périmée après 3.
 */
export function useInvoicePreview(residenceId: string | undefined, id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...expensesQueryKey(residenceId ?? 'none'), 'invoice-url', id ?? 'none'],
    queryFn: async () => (await invoiceUrl(id ?? '')).url,
    enabled: enabled && residenceId !== undefined && id !== undefined,
    staleTime: INVOICE_URL_MAX_CACHE_MS - 60_000,
    gcTime: INVOICE_URL_MAX_CACHE_MS,
  });
}

/**
 * « Voir la facture » : une nouvelle URL signée est demandée à chaque ouverture (aucun cache),
 * puis ouverte dans le navigateur intégré (image ou PDF). L'URL n'est ni stockée ni journalisée.
 */
export function useOpenInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { url } = await invoiceUrl(id);
      await WebBrowser.openBrowserAsync(url);
    },
    gcTime: 0,
  });
}

/** Annulation d'une dépense (motif obligatoire) : caisse, journal et dépenses sont rafraîchis. */
export function useCancelExpense(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<ExpenseDetail>(`/api/expenses/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSettled: async () => {
      const id = residenceId ?? 'none';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cashQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: expensesQueryKey(id) }),
      ]);
    },
  });
}

/** Solde de départ et historique de ses changements (GET /api/residences/current/opening-balance). */
export type OpeningBalanceState = {
  openingBalance: number;
  openingBalanceDate: string | null;
  changes: {
    id: string;
    oldAmount: number | null;
    newAmount: number;
    asOfDate: string;
    reason: string | null;
    changedAt: string;
  }[];
};

export function useOpeningBalance(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...cashQueryKey(residenceId ?? 'none'), 'opening'],
    queryFn: () => apiFetch<OpeningBalanceState>('/api/residences/current/opening-balance'),
    enabled: residenceId !== undefined,
  });
}

/** Saisie ou correction du solde de départ : le solde de la caisse et l'historique sont rafraîchis. */
export function useSetOpeningBalance(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetOpeningBalanceInput) =>
      apiFetch<{ openingBalance: number; openingBalanceDate: string; corrected: boolean }>(
        '/api/residences/current/opening-balance',
        { method: 'PUT', body: JSON.stringify(input) },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cashQueryKey(residenceId ?? 'none') }),
  });
}
