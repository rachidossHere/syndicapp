// Textes des notifications (plan 08), par type et par langue.
// Règle de sécurité (AGENTS.md) : ces textes sont visibles sur l'écran verrouillé. Ils sont donc
// TOUS génériques et fixes : jamais de montant, de nom, de numéro de lot ni de texte libre (pas
// même le titre d'une annonce), et jamais de chiffre. Aucune donnée de l'appelant n'y entre.
import type { NotificationType, PushLocale } from '@syndic/shared';

export type NotificationText = { title: string; body: string };

const APP_NAME = 'SyndicApp';

const BODIES: Record<NotificationType, Record<PushLocale, string>> = {
  announcement: {
    fr: 'Nouvelle annonce dans votre résidence',
    ar: 'إعلان جديد في إقامتك',
  },
  announcement_urgent: {
    fr: 'Annonce urgente dans votre résidence',
    ar: 'إعلان عاجل في إقامتك',
  },
  issue_status: {
    fr: 'Votre signalement a été mis à jour',
    ar: 'تم تحديث بلاغك',
  },
  issue_urgent: {
    fr: 'Nouveau signalement urgent dans votre résidence',
    ar: 'بلاغ عاجل جديد في إقامتك',
  },
  charge_reminder: {
    fr: 'Un rappel de charges vous attend dans SyndicApp',
    ar: 'تذكير بالتكاليف ينتظرك في SyndicApp',
  },
  payment_received: {
    fr: 'Votre paiement a bien été enregistré',
    ar: 'تم تسجيل دفعتك',
  },
};

/** Texte d'une notification : fixe pour un type et une langue donnés. */
export function notificationText(type: NotificationType, locale: PushLocale): NotificationText {
  return { title: APP_NAME, body: BODIES[type][locale] };
}
