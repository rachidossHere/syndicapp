import type { AnnouncementCategory, AnnouncementErrorKey } from '@syndic/shared';

/** Refus de l'API des annonces (clés de @syndic/shared) : le typage exige une traduction pour chacun. */
const announcementErrors: Record<AnnouncementErrorKey, string> = {
  'announcements.errors.notFound': 'Annonce introuvable. Actualisez la liste.',
};

const categories: Record<`announcements.category.${AnnouncementCategory}`, string> = {
  'announcements.category.works': 'Travaux',
  'announcements.category.meeting': 'Assemblée',
  'announcements.category.info': 'Info',
  'announcements.category.urgent': 'Urgent',
};

/** Textes des annonces (plan 08, étape 3 ; écrans 3, 4, 5 et 7 de docs/annonces.png). */
export const frAnnouncementTexts = {
  ...announcementErrors,
  ...categories,

  // Accueil : entrée « Annonces » et carte « Dernière annonce ».
  'home.announcements': 'Annonces',
  'home.announcementsBody': 'Les nouvelles de votre résidence.',
  'announcements.latest.title': 'Dernière annonce',
  'announcements.latest.seeAll': 'Voir toutes les annonces',

  // Liste (écran 3).
  'announcements.title': 'Annonces',
  'announcements.pinned': 'Épinglée',
  'announcements.new': 'Nouvelle annonce',
  'announcements.loadError': 'Impossible de charger les annonces.',
  'announcements.loadMoreError': 'Impossible de charger la suite des annonces.',
  'announcements.empty.title': 'Aucune annonce pour l’instant',
  'announcements.empty.body': 'Les annonces de la résidence apparaîtront ici.',
  'announcements.empty.bodyManager': 'Publiez la première annonce pour prévenir tous les membres.',
  'announcements.rowLabel': '{title}, {category}',
  'announcements.pinnedRowLabel': '{title}, {category}, épinglée',

  // Auteur (par son rôle, jamais par son nom) et date.
  'announcements.author.manager': 'Le syndic',
  'announcements.author.deputy': 'L’adjoint',
  'announcements.when.today': 'aujourd’hui à {time}',
  'announcements.when.yesterday': 'hier',
  'announcements.meta': '{author} · {when}',

  // Détail.
  'announcements.detail.title': 'Annonce',
  'announcements.pin': 'Épingler',
  'announcements.unpin': 'Désépingler',
  'announcements.toast.pinned': 'Annonce épinglée',
  'announcements.toast.unpinned': 'Annonce désépinglée',
  'announcements.pinError': 'Impossible de modifier l’épinglage. Réessayez.',

  // Nouvelle annonce (écran 4).
  'announcements.form.title': 'Nouvelle annonce',
  'announcements.field.category': 'Catégorie',
  'announcements.field.title': 'Titre',
  'announcements.field.titlePlaceholder': 'Ex. Coupure d’eau jeudi 20 nov.',
  'announcements.field.body': 'Message',
  'announcements.field.bodyPlaceholder': 'Détails pour les habitants',
  'announcements.pinToggle.label': 'Épingler en haut',
  'announcements.pinToggle.description': 'Reste en tête de la liste',
  'announcements.audience.unknown': 'Les membres de la résidence seront prévenus',
  'announcements.audience.one': '1 membre de la résidence sera prévenu',
  'announcements.audience.other': 'Les {count} membres de la résidence seront prévenus',
  'announcements.audience.none': 'Aucun autre membre à prévenir pour l’instant',
  'announcements.submit': 'Publier l’annonce',
  'announcements.toast.published': 'Annonce publiée',
  'announcements.errors.titleRequired': 'Indiquez un titre.',
  'announcements.errors.titleTooLong': '80 caractères au maximum.',
  'announcements.errors.bodyRequired': 'Écrivez le message.',
  'announcements.errors.bodyTooLong': '1 000 caractères au maximum.',

  // Bouton de test, visible en développement seulement (écran Notifications).
  'announcements.simulate.button': 'Simuler une notification',
  'announcements.simulate.hint': 'Test (développement) : une notification locale arrive dans 5 secondes. Touchez-la pour ouvrir l’écran lié.',
  'announcements.simulate.scheduled': 'Notification programmée : mettez l’appli en arrière-plan, elle arrive dans 5 secondes.',
  'announcements.simulate.noAnnouncement': 'Publiez d’abord une annonce dans cette résidence.',
  'announcements.simulate.denied': 'Autorisez les notifications du téléphone pour tester.',
  'announcements.simulate.failed': 'La notification de test n’a pas pu être programmée.',
  'announcements.simulate.body': 'Nouvelle annonce dans votre résidence',
  'announcements.simulate.bodyUrgent': 'Annonce urgente dans votre résidence',
} as const;
