import type { UiMessageKey } from '../i18n/messages';

/** Tons disponibles pour les badges ; chacun correspond à une paire `<ton>Bg` / `<ton>Fg`. */
export const statusTones = ['success', 'warning', 'danger', 'info'] as const;
export type StatusTone = (typeof statusTones)[number];

export type StatusDefinition = {
  readonly domain: 'payment' | 'charge_call' | 'report';
  readonly tone: StatusTone;
  /** Clé de traduction du libellé (FR et AR) : un état n'est jamais signalé par la couleur seule. */
  readonly labelKey: UiMessageKey;
};

/**
 * Correspondance entre statut métier, ton et libellé (plan 02).
 * Libellés FR : Payé, Partiel, Impayé ; appel de charges : En cours, Clôturé ;
 * signalement : Ouvert, En cours, Résolu.
 */
export const statuses = {
  // Paiement
  paid: { domain: 'payment', tone: 'success', labelKey: 'status.payment.paid' },
  partial: { domain: 'payment', tone: 'warning', labelKey: 'status.payment.partial' },
  unpaid: { domain: 'payment', tone: 'danger', labelKey: 'status.payment.unpaid' },
  // Appel de charges (plan 05) : en cours d'encaissement, ou entièrement encaissé.
  ongoing: { domain: 'charge_call', tone: 'warning', labelKey: 'status.charge_call.ongoing' },
  closed: { domain: 'charge_call', tone: 'success', labelKey: 'status.charge_call.closed' },
  // Signalement
  open: { domain: 'report', tone: 'danger', labelKey: 'status.report.open' },
  in_progress: { domain: 'report', tone: 'warning', labelKey: 'status.report.in_progress' },
  resolved: { domain: 'report', tone: 'success', labelKey: 'status.report.resolved' },
} as const satisfies Record<string, StatusDefinition>;

export type BusinessStatus = keyof typeof statuses;
