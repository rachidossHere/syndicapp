/**
 * Textes des écrans en accordéons (plan 02b, étape 5) : résumés des sections fermées, pagination,
 * états d'erreur. Singulier et pluriel : clés distinctes (`…One` / `…Many`), paramètre `{count}`.
 */
export const frSectionTexts = {
  'sections.loadError': 'Impossible de charger cette section.',
  'sections.loadMore': 'Afficher plus',
  'sections.loadMoreError': 'Impossible de charger la suite.',

  // Charges : une section par année.
  'sections.charges.callsOne': '1 appel',
  'sections.charges.calls': '{count} appels',
  'sections.charges.collectedPct': '{percent} % encaissé',
  'sections.charges.settled': 'Soldé',
  'sections.charges.callLine': '{paid} / {total} payés · échéance {date}',

  // Impayés d'un appel : une section par bâtiment.
  'sections.unpaid.summaryOne': '1 impayé · {amount} restant',
  'sections.unpaid.summaryMany': '{count} impayés · {amount} restants',

  // Mes charges : une section par année.
  'sections.mine.paidOfOne': '{paid} payé sur {total}',
  'sections.mine.paidOfMany': '{paid} payés sur {total}',

  // Comptes : une section par mois.
  'sections.accounts.summary': '+{collected} · −{spent}',

  // Signalements : une section par statut.
  'sections.issues.open': 'Ouverts',
  'sections.issues.in_progress': 'En cours',
  'sections.issues.resolved': 'Résolus',
  'sections.issues.openSummary': '{count} à prendre en charge',
  'sections.issues.inProgressSummary': '{count} en traitement',
  'sections.issues.resolvedSummaryOne': '1 résolu',
  'sections.issues.resolvedSummary': '{count} résolus',
  'sections.issues.empty': 'Aucun signalement dans cette section.',

  // Annonces : une section par mois.
  'sections.announcements.countOne': '1 annonce',
  'sections.announcements.count': '{count} annonces',

  // Profil : lignes de la carte.
  'sections.profile.residenceHint': '{role} · changer de résidence',
  'sections.profile.languageHint': 'Français ou arabe',
};
