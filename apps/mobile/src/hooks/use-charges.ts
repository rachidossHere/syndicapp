// Appels de charges, encaissements et reçus (plan 05) : requêtes et mutations TanStack Query.
// Après un encaissement ou une annulation, tout ce qui dépend des dus est rafraîchi.
import type { ChargePeriod, DueStatus, PaymentMethod, Role } from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { apiFetch } from '@/lib/api';

/** Toutes les données de charges d'une résidence : invalidées ensemble. */
export const chargesQueryKey = (residenceId: string) => ['charges', residenceId] as const;
const callsKey = (residenceId: string) => [...chargesQueryKey(residenceId), 'calls'] as const;
const callKey = (residenceId: string, id: string) => [...chargesQueryKey(residenceId), 'call', id] as const;
const residenceKey = (residenceId: string) => ['residence-current', residenceId] as const;

/** Un appel avec ses totaux (GET /api/charge-calls). Montants en centimes. */
export type ChargeCallSummary = {
  id: string;
  periodLabel: string;
  amountPerLot: number;
  dueDate: string;
  lotCount: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
};

export type DuePayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
};

export type DueRow = {
  id: string;
  lotId: string;
  lotReference: string;
  amountDue: number;
  amountPaid: number;
  remaining: number;
  status: DueStatus;
  payments: DuePayment[];
};

/** Détail d'un appel, lot par lot (GET /api/charge-calls/:id). */
export type ChargeCallDetail = {
  id: string;
  periodLabel: string;
  amountPerLot: number;
  dueDate: string;
  dues: DueRow[];
};

export type CurrentResidence = { id: string; name: string; chargePeriod: ChargePeriod };

/** Résidence active avec sa périodicité de charges (GET /api/residences/current). */
export function useCurrentResidence(residenceId: string | undefined) {
  return useQuery({
    queryKey: residenceKey(residenceId ?? 'none'),
    queryFn: () => apiFetch<CurrentResidence>('/api/residences/current'),
    enabled: residenceId !== undefined,
  });
}

/** Appels de charges de la résidence, le plus récent en premier. */
export function useChargeCalls(residenceId: string | undefined) {
  return useQuery({
    queryKey: callsKey(residenceId ?? 'none'),
    queryFn: async () => (await apiFetch<{ chargeCalls: ChargeCallSummary[] }>('/api/charge-calls')).chargeCalls,
    enabled: residenceId !== undefined,
  });
}

/** Détail d'un appel (réservé aux encaisseurs : syndic et trésorier). */
export function useChargeCall(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: callKey(residenceId ?? 'none', id ?? 'none'),
    queryFn: () => apiFetch<ChargeCallDetail>(`/api/charge-calls/${encodeURIComponent(id ?? '')}`),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

export type NewChargeCall = { periodLabel: string; amountPerLot: number; dueDate: string };

export function useCreateChargeCall(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewChargeCall) =>
      apiFetch<{ id: string; lotCount: number; totalDue: number }>('/api/charge-calls', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
  });
}

export type NewPayment = { chargeDueId: string; amount: number; method: PaymentMethod };
export type CreatedPayment = {
  payment: { id: string; amount: number; method: PaymentMethod; paidAt: string };
  receipt: { id: string; number: string };
  due: { id: string; amountDue: number; amountPaid: number; remaining: number; status: DueStatus };
};

/** Encaissement : la liste des appels et leur détail sont rafraîchis après succès. */
export function useCreatePayment(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPayment) =>
      apiFetch<CreatedPayment>('/api/payments', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
  });
}

/** Annulation d'un paiement, avec motif obligatoire. */
export function useCancelPayment(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiFetch<unknown>(`/api/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
  });
}

/**
 * Ouvre le reçu PDF : l'API renvoie une URL signée de 5 minutes, ouverte dans le navigateur intégré.
 * L'URL n'est ni stockée ni journalisée : elle est redemandée à chaque ouverture.
 */
export function useOpenReceipt() {
  return useMutation({
    mutationFn: async (receiptId: string) => {
      const { url } = await apiFetch<{ url: string }>(`/api/receipts/${encodeURIComponent(receiptId)}/url`);
      await WebBrowser.openBrowserAsync(url);
    },
  });
}

/** Un paiement vu par le copropriétaire (sans le motif d'annulation, réservé aux encaisseurs). */
export type MyPayment = Omit<DuePayment, 'cancelReason'>;

/** Un dû de l'un de mes appartements (GET /api/me/dues). */
export type MyDue = {
  id: string;
  chargeCallId: string;
  periodLabel: string;
  dueDate: string;
  lotReference: string;
  amountDue: number;
  amountPaid: number;
  remaining: number;
  status: DueStatus;
  payments: MyPayment[];
};

/**
 * Mes charges : dus des appartements dont je suis copropriétaire, le plus récent en premier.
 * À n'activer que pour un copropriétaire : un locataire ou un gardien ne fait aucune requête.
 */
export function useMyDues(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'mine'],
    queryFn: async () => (await apiFetch<{ dues: MyDue[] }>('/api/me/dues')).dues,
    enabled: residenceId !== undefined,
  });
}

/** Détail d'un reçu (GET /api/receipts/:id) : le rôle de l'encaisseur, jamais son nom. */
export type ReceiptDetail = {
  id: string;
  number: string;
  residenceName: string;
  lotReference: string;
  periodLabel: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  recordedByRole: Role | null;
  cancelledAt: string | null;
};

export function useReceipt(residenceId: string | undefined, receiptId: string | undefined) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'receipt', receiptId ?? 'none'],
    queryFn: () => apiFetch<ReceiptDetail>(`/api/receipts/${encodeURIComponent(receiptId ?? '')}`),
    enabled: residenceId !== undefined && receiptId !== undefined,
  });
}

/** URL signée du reçu PDF (5 minutes), redemandée à chaque usage : jamais stockée. */
export async function fetchReceiptUrl(receiptId: string): Promise<string> {
  return (await apiFetch<{ url: string }>(`/api/receipts/${encodeURIComponent(receiptId)}/url`)).url;
}
