// Toucher d'une notification d'annonce (plan 08, étape 3) : lecture des données jointes et choix de
// l'écran à ouvrir. Fonctions pures, sans React ni expo-notifications : testées avec vitest.
//
// Les données d'une vraie notification sont { type, residenceId, itemId } (voir apps/api/src/notify) :
// ni titre, ni texte, ni nom. La notification locale du bouton de test (développement) porte
// exactement les mêmes données.
import type { Language, NotificationType } from '@syndic/shared';

import { translate } from '../i18n/translate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const ANNOUNCEMENT_TYPES: readonly string[] = ['announcement', 'announcement_urgent'];

export type AnnouncementNotificationTarget = { residenceId: string; announcementId: string };

/** Données d'une notification d'annonce, ou `null` pour toute autre notification ou donnée invalide. */
export function parseAnnouncementNotification(data: unknown): AnnouncementNotificationTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, residenceId, itemId } = data as Record<string, unknown>;
  if (typeof type !== 'string' || !ANNOUNCEMENT_TYPES.includes(type)) return null;
  if (!isUuid(residenceId) || !isUuid(itemId)) return null;
  return { residenceId, announcementId: itemId };
}

export type NotificationNavigation =
  /** Résidence active : le détail s'ouvre directement. */
  | { kind: 'open'; announcementId: string }
  /** Autre résidence dont l'utilisateur est membre : on bascule dessus, puis le détail s'ouvre. */
  | { kind: 'switch_and_open'; residenceId: string; announcementId: string }
  /** Résidence inconnue de l'utilisateur : l'accueil, sans erreur. */
  | { kind: 'home' };

/**
 * Que faire au toucher d'une notification d'annonce :
 * - l'utilisateur n'est pas membre de la résidence de la notification → l'accueil ;
 * - c'est la résidence active → le détail ;
 * - sinon (autre résidence dont il est membre) → bascule sur cette résidence, puis le détail.
 */
export function planAnnouncementNavigation(
  target: AnnouncementNotificationTarget,
  activeResidenceId: string | null,
  memberResidenceIds: readonly string[],
): NotificationNavigation {
  if (!memberResidenceIds.includes(target.residenceId)) return { kind: 'home' };
  if (target.residenceId === activeResidenceId) return { kind: 'open', announcementId: target.announcementId };
  return { kind: 'switch_and_open', residenceId: target.residenceId, announcementId: target.announcementId };
}

export type LocalAnnouncementNotification = {
  title: string;
  body: string;
  data: { type: NotificationType; residenceId: string; itemId: string };
};

/** Nom de l'appli affiché comme titre des notifications (le même que celui de l'API). */
const APP_NAME = 'SyndicApp';

/**
 * Notification locale de test : même titre, même texte générique et mêmes données qu'une vraie
 * notification d'annonce (jamais le titre de l'annonce).
 */
export function simulatedAnnouncementNotification(args: {
  residenceId: string;
  announcementId: string;
  language: Language;
  urgent?: boolean;
}): LocalAnnouncementNotification {
  const urgent = args.urgent === true;
  return {
    title: APP_NAME,
    body: translate(args.language, urgent ? 'announcements.simulate.bodyUrgent' : 'announcements.simulate.body'),
    data: {
      type: urgent ? 'announcement_urgent' : 'announcement',
      residenceId: args.residenceId,
      itemId: args.announcementId,
    },
  };
}

/** Le bouton « Simuler une notification d'annonce » n'existe qu'en développement. */
export const showNotificationSimulation = (isDev: boolean): boolean => isDev;
