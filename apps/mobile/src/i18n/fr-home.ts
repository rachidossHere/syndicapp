// Textes de la barre d'onglets, des accueils et du Profil (plan 02b, étape 3), en français.
// Les pluriels suivent la convention de l'appli : `.one` pour 1, `.other` sinon.
export const frHomeTexts = {
  // Barre d'onglets
  'tabs.home': 'Accueil',
  'tabs.charges': 'Charges',
  'tabs.accounts': 'Comptes',
  'tabs.myCharges': 'Mes charges',
  'tabs.issues': 'Signalements',
  'tabs.report': 'Signaler',
  'tabs.announcements': 'Annonces',
  'tabs.profile': 'Profil',
  'tabs.a11yLabel': 'Navigation principale',

  // Salutation : « Mercredi 18 novembre » (fuseau Africa/Casablanca)
  'home.date': '{weekday} {day} {month}',
  'home.weekday.1': 'Lundi',
  'home.weekday.2': 'Mardi',
  'home.weekday.3': 'Mercredi',
  'home.weekday.4': 'Jeudi',
  'home.weekday.5': 'Vendredi',
  'home.weekday.6': 'Samedi',
  'home.weekday.7': 'Dimanche',
  'home.heroRole': 'Vous êtes {role}',

  // Accueil du syndic, du trésorier et de l'adjoint
  'home.cash.title': 'Solde de la caisse',
  'home.cash.collected': 'encaissés',
  'home.cash.spent': 'dépensés',
  'home.cash.period': 'Période : {period}',
  'home.cash.a11y': 'Solde de la caisse : {balance}. {collected} encaissés et {spent} dépensés, période {period}. Ouvre les comptes.',
  'home.cash.loadError': 'Impossible de charger la caisse.',
  'home.attention.title': 'À traiter',
  'home.attention.unpaid.one': '1 impayé',
  'home.attention.unpaid.other': '{count} impayés',
  'home.attention.urgent.one': '1 signalement urgent',
  'home.attention.urgent.other': '{count} signalements urgents',
  'home.attention.toHandle.one': '1 signalement à traiter',
  'home.attention.toHandle.other': '{count} signalements à traiter',
  'home.quick.title': 'Accès rapide',
  'home.quick.expense': 'Dépense',

  // Accueil de l'habitant
  'home.charges.title': 'Charges de {period}',
  'home.charges.progress': 'Payé : {paid} sur {total}',
  'home.charges.allPaidTitle': 'Tout est réglé',
  'home.charges.allPaidBody': 'Merci. Votre reçu est dans l’historique.',
  'home.charges.seeMine': 'Voir mes charges',

  // Profil
  'profile.title': 'Profil',
  'profile.residence': 'Résidence active',
  'profile.noResidence': 'Aucune résidence active',
  'profile.switchResidence': 'Changer de résidence',
  'profile.language': 'Langue',
  'profile.language.fr': 'Français',
  'profile.language.ar': 'العربية',
  'profile.version': 'SyndicApp · version {version}',
} as const;
