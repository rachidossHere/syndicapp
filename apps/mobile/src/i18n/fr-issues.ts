import type { IssueErrorKey, IssueLocation, IssueStatus } from '@syndic/shared';

/** Refus de l'API des signalements (clés de @syndic/shared) : le typage exige une traduction pour chacun. */
const issueErrors: Record<IssueErrorKey, string> = {
  'issues.errors.notFound': 'Signalement introuvable. Actualisez la liste.',
  'issues.errors.invalidFileType': 'Format non accepté. Choisissez une photo (JPEG ou PNG).',
  'issues.errors.fileTooLarge': 'Cette photo est trop lourde (10 Mo au maximum).',
  'issues.errors.photoNotFound': 'La photo n’a pas été reçue. Réessayez de l’envoyer.',
  'issues.errors.statusUnchanged': 'Le signalement a déjà ce statut.',
  'issues.errors.commentForbidden': 'Seul l’auteur du signalement peut le commenter.',
  'issues.errors.reopenForbidden': 'Seul l’auteur du signalement peut le rouvrir.',
  'issues.errors.notResolved': 'Ce signalement n’est pas résolu.',
  'issues.errors.reopenExpired': 'Ce signalement est résolu depuis plus de 7 jours : il ne peut plus être rouvert.',
};

const statuses: Record<`issues.status.${IssueStatus}`, string> = {
  'issues.status.open': 'Ouvert',
  'issues.status.in_progress': 'En cours',
  'issues.status.resolved': 'Résolu',
};

const locations: Record<`issues.location.${IssueLocation}`, string> = {
  'issues.location.elevator': 'Ascenseur',
  'issues.location.stairs': 'Escalier',
  'issues.location.parking': 'Parking',
  'issues.location.hall': 'Hall',
  'issues.location.roof': 'Toiture',
  'issues.location.other': 'Autre',
};

/** Textes des écrans de l'habitant (plan 07, étape 2 ; écrans 1, 2, 3 et 6 de docs/signalements.png). */
export const frIssueTexts = {
  ...issueErrors,
  ...statuses,
  ...locations,

  // Erreurs du formulaire et de la photo.
  'issues.errors.titleRequired': 'Indiquez le problème.',
  'issues.errors.titleTooLong': '120 caractères au maximum.',
  'issues.errors.locationRequired': 'Choisissez un emplacement.',
  'issues.errors.descriptionTooLong': '2 000 caractères au maximum.',
  'issues.errors.uploadFailed': 'L’envoi de la photo a échoué. Réessayez.',
  'issues.errors.cameraDenied':
    'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez une image.',
  'issues.errors.pickFailed': 'Impossible de lire cette photo. Essayez-en une autre.',
  'issues.errors.messageRequired': 'Écrivez un message.',

  'home.issues': 'Signalements',
  'home.issuesBody': 'Signaler un problème, suivre son traitement.',

  // Liste.
  'issues.title': 'Signalements',
  'issues.new': 'Signaler un problème',
  'issues.filter.active': 'En cours · {count}',
  'issues.filter.resolved': 'Résolus · {count}',
  'issues.urgent': 'Urgent',
  'issues.visibility':
    'Tous les habitants voient les signalements, pour éviter les doublons. Votre nom reste visible seulement par le syndic et le gardien.',
  'issues.loadError': 'Impossible de charger les signalements.',
  'issues.loadMoreError': 'Impossible de charger la suite des signalements.',
  'issues.empty.title': 'Aucun signalement pour l’instant',
  'issues.empty.body': 'Un problème dans la résidence ? Signalez-le, tout le monde pourra le suivre.',
  'issues.emptyResolved.title': 'Aucun signalement résolu',
  'issues.emptyResolved.body': 'Les problèmes réglés apparaîtront ici.',
  'issues.line': '{location} · {age}',
  'issues.rowLabel': '{title}, {status}',

  // Âge d'un signalement dans la liste, et heure.
  'issues.age.now': 'à l’instant',
  'issues.age.minutes': 'il y a {count} min',
  'issues.age.hours': 'il y a {count} h',
  'issues.age.yesterday': 'hier',
  'issues.age.date': '{day} {month}',
  'issues.time': '{hour} h {minute}',

  // Signaler un problème.
  'issues.form.title': 'Signaler un problème',
  'issues.field.title': 'Quel est le problème ?',
  'issues.field.titlePlaceholder': 'Ex. : lampe grillée escalier B',
  'issues.field.location': 'Où ?',
  'issues.field.description': 'Détails (facultatif)',
  'issues.field.descriptionPlaceholder': 'Ex. : entre le 2e et le 3e étage, côté porte.',
  'issues.photo.add': 'Ajouter une photo',
  'issues.photo.or': 'ou choisir une image de la galerie',
  'issues.photo.preparing': 'Préparation de la photo…',
  'issues.photo.added': 'Photo ajoutée',
  'issues.photo.changeTitle': 'Photo',
  'issues.photo.changeLabel': 'Photo ajoutée. Toucher pour la reprendre ou la retirer.',
  'issues.photo.previewLabel': 'Aperçu de la photo',
  'issues.photo.retake': 'Reprendre la photo',
  'issues.photo.another': 'Choisir une autre image',
  'issues.photo.remove': 'Retirer la photo',
  'issues.urgent.label': 'C’est urgent',
  'issues.urgent.description': 'Danger, panne bloquante, fuite importante',
  'issues.submit': 'Envoyer le signalement',
  'issues.uploading': 'Envoi de la photo… {percent} %',
  'issues.toast.sent': 'Signalement envoyé',

  // Détail.
  'issues.detail.reportedToday': '{location} · signalé aujourd’hui à {time}',
  'issues.detail.reportedYesterday': '{location} · signalé hier à {time}',
  'issues.detail.reportedOn': '{location} · signalé le {date} à {time}',
  'issues.detail.description': 'Détails',
  'issues.detail.photoLoading': 'Chargement de la photo…',
  'issues.detail.photoError': 'Impossible d’afficher la photo.',
  'issues.detail.photoBadge': 'Photo',
  'issues.detail.loadError': 'Impossible de charger ce signalement.',
  'issues.detail.notFound': 'Ce signalement n’existe plus.',
  'issues.detail.follow': 'Suivi',
  'issues.detail.refreshError': 'Impossible d’actualiser. Les informations affichées peuvent être anciennes.',
  'issues.comment.placeholder': 'Ajouter un commentaire',
  'issues.comment.send': 'Envoyer le commentaire',
  'issues.reopen.button': 'Rouvrir ce signalement',
  'issues.reopen.note': 'Le problème persiste ? Vous pouvez le rouvrir pendant 7 jours après sa résolution.',

  // Historique.
  'issues.event.created': 'Signalé',
  'issues.event.comment': 'Commentaire',
  'issues.event.reopened': 'Rouvert',
  'issues.event.by': 'Par {actor}',
  'issues.event.titleBy': '{title} · {actor}',
  'issues.event.detail': '{message} · {time}',
  'issues.event.quote': '« {message} »',
  'issues.actor.you': 'vous',
  'issues.actor.manager': 'le syndic',
  'issues.actor.treasurer': 'le trésorier',
  'issues.actor.deputy': 'l’adjoint',
  'issues.actor.caretaker': 'le gardien',
  'issues.actor.resident': 'un habitant',
} as const;
