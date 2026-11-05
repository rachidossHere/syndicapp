import type { UiMessageKey } from '../i18n/messages';

/** Tons disponibles pour les badges ; chacun correspond à une paire `<ton>Bg` / `<ton>Fg`. */
export const statusTones = ['success', 'warning', 'danger', 'info'] as const;
export type StatusTone = (typeof statusTones)[number];

export type StatusDefinition = {
  readonly domain: 'payment' | 'report';
  readonly tone: StatusTone;
  /** Clé de traduction du libellé (FR et AR) : un état n'est jamais signalé par la couleur seule. */
  readonly labelKey: UiMessageKey;
};

/**
 * Correspondance entre statut métier, ton et libellé (plan 02).
 * Libellés FR : Payé, Impayé, Ouvert, En cours, Résolu.
 */
export const statuses = {
  // Paiement
  paid: { domain: 'payment', tone: 'success', labelKey: 'status.payment.paid' },
  unpaid: { domain: 'payment', tone: 'danger', labelKey: 'status.payment.unpaid' },
  // Signalement
  open: { domain: 'report', tone: 'danger', labelKey: 'status.report.open' },
  in_progress: { domain: 'report', tone: 'warning', labelKey: 'status.report.in_progress' },
  resolved: { domain: 'report', tone: 'success', labelKey: 'status.report.resolved' },
} as const satisfies Record<string, StatusDefinition>;

export type BusinessStatus = keyof typeof statuses;
