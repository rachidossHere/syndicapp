import type { NOTIFICATION_ERRORS, NotificationType } from '@syndic/shared';

/** Refus de l'API des notifications (clés de @syndic/shared) : le typage exige une traduction pour chacun. */
const errors: Record<(typeof NOTIFICATION_ERRORS)[keyof typeof NOTIFICATION_ERRORS], string> = {
  'notifications.errors.locked': 'Les annonces urgentes ne peuvent pas être coupées.',
  'notifications.errors.tokenNotFound': 'Ce téléphone n’est plus enregistré pour les notifications.',
};

const types: Record<`notifications.type.${NotificationType}.${'title' | 'body'}`, string> = {
  'notifications.type.announcement_urgent.title': 'Annonces urgentes',
  'notifications.type.announcement_urgent.body': 'Toujours activées',
  'notifications.type.announcement.title': 'Annonces',
  'notifications.type.announcement.body': 'Travaux, réunions, informations',
  'notifications.type.issue_status.title': 'Mes signalements',
  'notifications.type.issue_status.body': 'Changement de statut',
  'notifications.type.charge_reminder.title': 'Rappels de charges',
  'notifications.type.charge_reminder.body': 'Envoyés par le syndic',
  'notifications.type.payment_received.title': 'Paiements reçus',
  'notifications.type.payment_received.body': 'Quand votre paiement est encaissé',
  'notifications.type.issue_urgent.title': 'Signalements urgents',
  'notifications.type.issue_urgent.body': 'Syndic, adjoint et gardien',
};

/** Textes des notifications (plan 08, étape 1) : écran « Restez informé » et écran « Notifications ». */
export const frNotificationTexts = {
  ...errors,
  ...types,
  'notifications.intro.title': 'Restez informé',
  'notifications.intro.body': 'SyndicApp vous prévient seulement quand c’est utile pour vous.',
  'notifications.intro.announcements': 'Annonces de la résidence',
  'notifications.intro.announcementsBody': 'Coupure d’eau, travaux, réunion',
  'notifications.intro.issues': 'Suivi de vos signalements',
  'notifications.intro.issuesBody': 'Quand le syndic les traite',
  'notifications.intro.charges': 'Charges et reçus',
  'notifications.intro.chargesBody': 'Rappels et paiements reçus',
  'notifications.intro.footnote': 'Aucun montant ni nom n’apparaît sur l’écran verrouillé.',
  'notifications.intro.enable': 'Activer les notifications',
  'notifications.intro.later': 'Plus tard',
  'notifications.title': 'Notifications',
  'notifications.subtitle': 'Choisissez ce que vous voulez recevoir sur ce téléphone.',
  'notifications.locked': 'Verrouillé : les annonces urgentes ne peuvent pas être coupées.',
  'notifications.office': 'Pour le bureau',
  'notifications.undetermined.body': 'Les notifications ne sont pas encore activées sur ce téléphone.',
  'notifications.denied.title': 'Notifications coupées sur ce téléphone ?',
  'notifications.denied.action': 'Ouvrir les réglages',
  'notifications.saveError': 'Le réglage n’a pas été enregistré. Réessayez.',
  // Bouton de test (développement) : mêmes textes génériques que l'API (apps/api/src/notify/texts.ts).
  'notifications.simulate.body.issue_status': 'Votre signalement a été mis à jour',
  'notifications.simulate.body.issue_urgent': 'Nouveau signalement urgent dans votre résidence',
  'notifications.simulate.body.charge_reminder': 'Un rappel de charges vous attend dans SyndicApp',
  'notifications.simulate.body.payment_received': 'Votre paiement a bien été enregistré',
  'notifications.simulate.noIssue': 'Créez d’abord un signalement dans cette résidence.',
  'home.notifications': 'Notifications',
  'home.notificationsBody': 'Choisissez ce que vous recevez',
} as const;
