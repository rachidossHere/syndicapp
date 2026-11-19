// Toucher d'une notification (plan 08, étapes 3 et 4) : lecture des données jointes et choix des
// écrans à ouvrir. Fonctions pures, sans React ni expo-notifications : testées avec vitest.
//
// Les données d'une vraie notification sont { type, residenceId, itemId? } (voir apps/api/src/notify) :
// ni titre, ni texte, ni nom. La notification locale du bouton de test (développement) porte
// exactement les mêmes données.
//
//   announcement, announcement_urgent → le détail de l'annonce
//   issue_status, issue_urgent        → le signalement
//   payment_received                  → « Mes charges », puis le reçu si l'identifiant est fourni
//   charge_reminder                   → « Mes charges »
import {
  NOTIFICATION_TYPES,
  type Language,
  type LatestAnnouncementResponse,
  type NotificationType,
} from '@syndic/shared';

import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isType = (value: unknown): value is NotificationType =>
  typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value);

/** Types dont l'identifiant de l'élément est indispensable pour ouvrir quelque chose. */
const NEEDS_ITEM: readonly NotificationType[] = [
  'announcement',
  'announcement_urgent',
  'issue_status',
  'issue_urgent',
];

export type NotificationTarget = {
  type: NotificationType;
  residenceId: string;
  itemId: string | null;
};

/**
 * Données d'une notification de l'appli, ou `null` pour toute autre notification ou donnée invalide.
 * L'identifiant est exigé pour les annonces et les signalements ; pour un paiement, il désigne le
 * reçu et son absence (ou une valeur invalide) donne simplement « Mes charges ».
 */
export function parseNotificationTarget(data: unknown): NotificationTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, residenceId, itemId } = data as Record<string, unknown>;
  if (!isType(type) || !isUuid(residenceId)) return null;
  if (NEEDS_ITEM.includes(type) && !isUuid(itemId)) return null;
  return { type, residenceId, itemId: isUuid(itemId) ? itemId : null };
}

/** Écran à ouvrir (chemins d'Expo Router). */
export type NotificationRoute =
  | { pathname: '/announcement/[id]'; params: { id: string } }
  | { pathname: '/issue/[id]'; params: { id: string } }
  | { pathname: '/receipt/[id]'; params: { id: string } }
  | { pathname: '/my-charges' };

/**
 * Cet écran est-il un onglet ? « Mes charges » est un onglet du copropriétaire (plan 02b, étape 3) : on
 * s'y rend avec `navigate`, sans empiler un second exemplaire des onglets. Les annonces, signalements
 * et reçus sont des écrans de détail : ils s'ouvrent au-dessus des onglets (bouton retour).
 */
export const routeIsTab = (route: NotificationRoute): boolean => route.pathname === '/my-charges';

/** Écrans à ouvrir, dans l'ordre : chacun s'empile sur le précédent. */
export function notificationRoutes(target: NotificationTarget): NotificationRoute[] {
  const { type, itemId } = target;
  switch (type) {
    case 'announcement':
    case 'announcement_urgent':
      return itemId ? [{ pathname: '/announcement/[id]', params: { id: itemId } }] : [];
    case 'issue_status':
    case 'issue_urgent':
      return itemId ? [{ pathname: '/issue/[id]', params: { id: itemId } }] : [];
    case 'payment_received':
      return itemId
        ? [{ pathname: '/my-charges' }, { pathname: '/receipt/[id]', params: { id: itemId } }]
        : [{ pathname: '/my-charges' }];
    case 'charge_reminder':
      return [{ pathname: '/my-charges' }];
  }
}

export type NotificationNavigation =
  /** Résidence active : les écrans s'ouvrent directement. */
  | { kind: 'open'; routes: NotificationRoute[] }
  /** Autre résidence dont l'utilisateur est membre : on bascule dessus, puis les écrans s'ouvrent. */
  | { kind: 'switch_and_open'; residenceId: string; routes: NotificationRoute[] }
  /** Résidence inconnue de l'utilisateur : l'accueil, sans erreur. */
  | { kind: 'home' };

/**
 * Que faire au toucher d'une notification :
 * - l'utilisateur n'est pas membre de la résidence de la notification → l'accueil ;
 * - c'est la résidence active → les écrans ;
 * - sinon (autre résidence dont il est membre) → bascule sur cette résidence, puis les écrans.
 */
export function planNotificationNavigation(
  target: NotificationTarget,
  activeResidenceId: string | null,
  memberResidenceIds: readonly string[],
): NotificationNavigation {
  if (!memberResidenceIds.includes(target.residenceId)) return { kind: 'home' };
  const routes = notificationRoutes(target);
  if (target.residenceId === activeResidenceId) return { kind: 'open', routes };
  return { kind: 'switch_and_open', residenceId: target.residenceId, routes };
}

export type LocalNotification = {
  title: string;
  body: string;
  data: { type: NotificationType; residenceId: string; itemId?: string };
};

/** Nom de l'appli affiché comme titre des notifications (le même que celui de l'API). */
const APP_NAME = 'SyndicApp';

/** Texte générique de chaque type : le même que celui de l'API (apps/api/src/notify/texts.ts). */
export const SIMULATED_BODY_KEYS: Record<NotificationType, TranslationKey> = {
  announcement: 'announcements.simulate.body',
  announcement_urgent: 'announcements.simulate.bodyUrgent',
  issue_status: 'notifications.simulate.body.issue_status',
  issue_urgent: 'notifications.simulate.body.issue_urgent',
  charge_reminder: 'notifications.simulate.body.charge_reminder',
  payment_received: 'notifications.simulate.body.payment_received',
};

/**
 * Notification locale de test : même titre, même texte générique et mêmes données qu'une vraie
 * notification (jamais un titre, un nom ou un montant).
 */
export function simulatedNotification(args: {
  type: NotificationType;
  residenceId: string;
  itemId?: string | null;
  language: Language;
}): LocalNotification {
  return {
    title: APP_NAME,
    body: translate(args.language, SIMULATED_BODY_KEYS[args.type]),
    data: {
      type: args.type,
      residenceId: args.residenceId,
      ...(args.itemId ? { itemId: args.itemId } : {}),
    },
  };
}

/** Le bouton de simulation n'existe qu'en développement. */
export const showNotificationSimulation = (isDev: boolean): boolean => isDev;

export type Fetcher = <T>(path: string) => Promise<T>;

/**
 * Identifiant à joindre à la notification d'un type, lu dans la résidence :
 * annonce la plus récente, signalement le plus récent, ou reçu de mon dernier paiement (facultatif).
 * `undefined` : il manque un élément indispensable (rien à ouvrir).
 */
export async function simulationItemId(
  type: NotificationType,
  get: Fetcher,
): Promise<string | null | undefined> {
  switch (type) {
    case 'announcement':
    case 'announcement_urgent': {
      const { announcement } = await get<LatestAnnouncementResponse>('/api/announcements/latest');
      return announcement?.id;
    }
    case 'issue_status':
    case 'issue_urgent': {
      const { items } = await get<{ items: { id: string }[] }>('/api/issues?limit=1');
      return items[0]?.id;
    }
    case 'payment_received': {
      // Le reçu est facultatif : sans lui (ou pour un rôle qui n'a pas de dû), « Mes charges » s'ouvre.
      try {
        const { dues } = await get<{
          dues: { payments: { receiptId: string | null; cancelledAt: string | null }[] }[];
        }>('/api/me/dues');
        const payment = dues
          .flatMap((due) => due.payments)
          .find((p) => p.receiptId !== null && p.cancelledAt === null);
        return payment?.receiptId ?? null;
      } catch {
        return null;
      }
    }
    case 'charge_reminder':
      return null;
  }
}
