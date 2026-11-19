// Appels de charges, encaissements et reçus (plan 05) : requêtes et mutations TanStack Query.
// Après un encaissement ou une annulation, tout ce qui dépend des dus est rafraîchi.
import {
  NO_BUILDING_PARAM,
  type ChargeCallSummaryResponse,
  type ChargePeriod,
  type DueStatus,
  type MyDuesSummaryResponse,
  type PaymentMethod,
  type ReminderResult,
  type Role,
  type UnpaidSummaryResponse,
} from '@syndic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { apiFetch, inResidence } from '@/lib/api';

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
  /** Relance (syndic seulement, charges.write) : dernière relance du lot, et prochaine possible (null si possible maintenant). */
  lastReminderAt?: string | null;
  nextReminderAt?: string | null;
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
    queryFn: () => apiFetch<CurrentResidence>('/api/residences/current', inResidence(residenceId)),
    enabled: residenceId !== undefined,
  });
}

/** Appels de charges de la résidence, le plus récent en premier. */
export function useChargeCalls(residenceId: string | undefined) {
  return useQuery({
    queryKey: callsKey(residenceId ?? 'none'),
    queryFn: async () => (await apiFetch<{ chargeCalls: ChargeCallSummary[] }>('/api/charge-calls', inResidence(residenceId))).chargeCalls,
    enabled: residenceId !== undefined,
  });
}

/**
 * Années d'appels, de la plus récente à la plus ancienne, avec leur résumé exact (GET /api/charge-calls/summary) :
 * ce que montre chaque section fermée de l'écran « Charges », sans charger un seul appel.
 */
export function useChargeYears(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'years'],
    queryFn: async () =>
      (await apiFetch<ChargeCallSummaryResponse>('/api/charge-calls/summary?groupBy=year', inResidence(residenceId))).years,
    enabled: residenceId !== undefined,
  });
}

/** Appels d'une année : chargés à l'ouverture de sa section seulement (GET /api/charge-calls?year=…). */
export function useChargeCallsOfYear(residenceId: string | undefined, year: string) {
  return useQuery({
    queryKey: [...callsKey(residenceId ?? 'none'), 'year', year],
    queryFn: async () =>
      (await apiFetch<{ chargeCalls: ChargeCallSummary[] }>(`/api/charge-calls?year=${year}`, inResidence(residenceId))).chargeCalls,
    enabled: residenceId !== undefined,
  });
}

/** Bâtiments d'un appel qui ont des impayés, avec le nombre de lots et le reste à payer. */
export function useUnpaidBuildings(residenceId: string | undefined, callId: string | undefined) {
  return useQuery({
    queryKey: [...callKey(residenceId ?? 'none', callId ?? 'none'), 'buildings'],
    queryFn: async () =>
      (
        await apiFetch<UnpaidSummaryResponse>(
          `/api/charge-calls/${encodeURIComponent(callId ?? '')}/summary?groupBy=building`,
          inResidence(residenceId),
        )
      ).buildings,
    enabled: residenceId !== undefined && callId !== undefined,
  });
}

/** Lots impayés ou partiels d'un bâtiment (`null` : sans bâtiment), chargés à l'ouverture de sa section. */
export function useUnpaidDues(residenceId: string | undefined, callId: string, building: string | null) {
  const param = building === null ? NO_BUILDING_PARAM : building;
  return useQuery({
    queryKey: [...callKey(residenceId ?? 'none', callId), 'unpaid', param],
    queryFn: () =>
      apiFetch<ChargeCallDetail>(
        `/api/charge-calls/${encodeURIComponent(callId)}?unpaid=true&building=${encodeURIComponent(param)}`,
        inResidence(residenceId),
      ),
    enabled: residenceId !== undefined,
  });
}

/** Détail d'un appel (réservé aux encaisseurs : syndic et trésorier). */
export function useChargeCall(residenceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: callKey(residenceId ?? 'none', id ?? 'none'),
    queryFn: () => apiFetch<ChargeCallDetail>(`/api/charge-calls/${encodeURIComponent(id ?? '')}`, inResidence(residenceId)),
    enabled: residenceId !== undefined && id !== undefined,
  });
}

export type NewChargeCall = { periodLabel: string; amountPerLot: number; dueDate: string };

export function useCreateChargeCall(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewChargeCall) =>
      apiFetch<{ id: string; lotCount: number; totalDue: number }>(
        '/api/charge-calls',
        inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) }),
      ),
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
      apiFetch<CreatedPayment>('/api/payments', inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
  });
}

/** Relance des impayés : un lot (`lotId`) ou tous (`all`, d'un appel si `chargeCallId`). Rafraîchit les dus. */
export type ReminderInput = { lotId: string } | { all: true; chargeCallId?: string };

export function useSendReminders(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderInput) =>
      apiFetch<ReminderResult>('/api/charges/reminders', inResidence(residenceId, { method: 'POST', body: JSON.stringify(input) })),
    // Succès ou refus (409 : relancé entre-temps) : les dates affichées sont relues.
    onSettled: () => queryClient.invalidateQueries({ queryKey: chargesQueryKey(residenceId ?? 'none') }),
  });
}

/** Annulation d'un paiement, avec motif obligatoire. */
export function useCancelPayment(residenceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiFetch<unknown>(
        `/api/payments/${encodeURIComponent(paymentId)}/cancel`,
        inResidence(residenceId, { method: 'POST', body: JSON.stringify({ reason }) }),
      ),
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
 * Années de mes dus avec leur résumé exact (« N payés sur M », total payé) : ce que montre chaque section
 * fermée de « Mes charges » (GET /api/me/dues/summary). Copropriétaire seulement.
 */
export function useMyDueYears(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'mine-years'],
    queryFn: async () =>
      (await apiFetch<MyDuesSummaryResponse>('/api/me/dues/summary?groupBy=year', inResidence(residenceId))).years,
    enabled: residenceId !== undefined,
  });
}

/** Mes dus d'une année : chargés à l'ouverture de sa section seulement (GET /api/me/dues?year=…). */
export function useMyDuesOfYear(residenceId: string | undefined, year: string) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'mine', 'year', year],
    queryFn: async () =>
      (await apiFetch<{ dues: MyDue[] }>(`/api/me/dues?year=${year}`, inResidence(residenceId))).dues,
    enabled: residenceId !== undefined,
  });
}

/**
 * Mes charges : dus des appartements dont je suis copropriétaire, le plus récent en premier.
 * À n'activer que pour un copropriétaire : un locataire ou un gardien ne fait aucune requête.
 */
export function useMyDues(residenceId: string | undefined) {
  return useQuery({
    queryKey: [...chargesQueryKey(residenceId ?? 'none'), 'mine'],
    queryFn: async () => (await apiFetch<{ dues: MyDue[] }>('/api/me/dues', inResidence(residenceId))).dues,
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
    queryFn: () => apiFetch<ReceiptDetail>(`/api/receipts/${encodeURIComponent(receiptId ?? '')}`, inResidence(residenceId)),
    enabled: residenceId !== undefined && receiptId !== undefined,
  });
}

/** URL signée du reçu PDF (5 minutes), redemandée à chaque usage : jamais stockée. */
export async function fetchReceiptUrl(receiptId: string): Promise<string> {
  return (await apiFetch<{ url: string }>(`/api/receipts/${encodeURIComponent(receiptId)}/url`)).url;
}
