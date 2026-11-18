import { NOTIFICATION_TYPES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import notificationsScreenSource from '../features/notifications/notifications-screen.tsx?raw';
import simulateButtonSource from '../features/notifications/simulate-notification-button.tsx?raw';
import {
  notificationRoutes,
  parseNotificationTarget,
  planNotificationNavigation,
  showNotificationSimulation,
  simulatedNotification,
  simulationItemId,
} from './notification-target';

const R1 = '0b5f0c8e-1c1e-4c8e-9a53-6f1d2a7b9c10';
const R2 = '7a1d5b6e-2f3c-4d8a-8b9e-1c2d3e4f5a6b';
const ITEM = '5d2c1b3a-9e8f-4a7b-a6c5-d4e3f2a1b0c9';

describe('lecture des données d’une notification', () => {
  it('annonces et signalements : type, résidence et identifiant exigés', () => {
    for (const type of ['announcement', 'announcement_urgent', 'issue_status', 'issue_urgent']) {
      expect(parseNotificationTarget({ type, residenceId: R1, itemId: ITEM })).toEqual({
        type,
        residenceId: R1,
        itemId: ITEM,
      });
      expect(parseNotificationTarget({ type, residenceId: R1 })).toBeNull();
      expect(parseNotificationTarget({ type, residenceId: R1, itemId: 'pas-un-uuid' })).toBeNull();
    }
  });

  it('paiement encaissé et rappel de charges : l’identifiant est facultatif', () => {
    expect(
      parseNotificationTarget({ type: 'payment_received', residenceId: R1, itemId: ITEM }),
    ).toEqual({
      type: 'payment_received',
      residenceId: R1,
      itemId: ITEM,
    });
    expect(
      parseNotificationTarget({ type: 'payment_received', residenceId: R1 })?.itemId,
    ).toBeNull();
    expect(
      parseNotificationTarget({ type: 'payment_received', residenceId: R1, itemId: 42 })?.itemId,
    ).toBeNull();
    expect(parseNotificationTarget({ type: 'charge_reminder', residenceId: R1 })).toEqual({
      type: 'charge_reminder',
      residenceId: R1,
      itemId: null,
    });
  });

  it('type inconnu, résidence invalide ou données absentes : ignorés (null)', () => {
    expect(parseNotificationTarget({ type: 'autre', residenceId: R1, itemId: ITEM })).toBeNull();
    expect(parseNotificationTarget({ type: 'charge_reminder', residenceId: 'x' })).toBeNull();
    expect(parseNotificationTarget({ residenceId: R1 })).toBeNull();
    expect(parseNotificationTarget(null)).toBeNull();
    expect(parseNotificationTarget(undefined)).toBeNull();
    expect(parseNotificationTarget('charge_reminder')).toBeNull();
  });
});

describe('écran ouvert au toucher, pour chaque type', () => {
  const target = (type: (typeof NOTIFICATION_TYPES)[number], itemId: string | null = ITEM) => ({
    type,
    residenceId: R1,
    itemId,
  });

  it('annonce (ordinaire ou urgente) : le détail de l’annonce', () => {
    for (const type of ['announcement', 'announcement_urgent'] as const) {
      expect(notificationRoutes(target(type))).toEqual([
        { pathname: '/announcement/[id]', params: { id: ITEM } },
      ]);
    }
  });

  it('signalement (statut ou urgent) : le signalement', () => {
    for (const type of ['issue_status', 'issue_urgent'] as const) {
      expect(notificationRoutes(target(type))).toEqual([
        { pathname: '/issue/[id]', params: { id: ITEM } },
      ]);
    }
  });

  it('paiement encaissé : « Mes charges », puis le reçu si l’identifiant est fourni', () => {
    expect(notificationRoutes(target('payment_received'))).toEqual([
      { pathname: '/my-charges' },
      { pathname: '/receipt/[id]', params: { id: ITEM } },
    ]);
    expect(notificationRoutes(target('payment_received', null))).toEqual([
      { pathname: '/my-charges' },
    ]);
  });

  it('rappel de charges : « Mes charges »', () => {
    expect(notificationRoutes(target('charge_reminder', null))).toEqual([
      { pathname: '/my-charges' },
    ]);
    expect(notificationRoutes(target('charge_reminder'))).toEqual([{ pathname: '/my-charges' }]);
  });

  it('chaque type de notification ouvre au moins un écran', () => {
    for (const type of NOTIFICATION_TYPES)
      expect(notificationRoutes(target(type)).length, type).toBeGreaterThan(0);
  });
});

describe('règle de résidence au toucher (tous les types)', () => {
  for (const type of NOTIFICATION_TYPES) {
    const target = { type, residenceId: R1, itemId: ITEM };
    const routes = notificationRoutes(target);

    it(`${type} : résidence active → ouvre directement`, () => {
      expect(planNotificationNavigation(target, R1, [R1, R2])).toEqual({ kind: 'open', routes });
    });

    it(`${type} : autre résidence dont on est membre → bascule puis ouvre`, () => {
      expect(planNotificationNavigation(target, R2, [R1, R2])).toEqual({
        kind: 'switch_and_open',
        residenceId: R1,
        routes,
      });
      expect(planNotificationNavigation(target, null, [R1])).toEqual({
        kind: 'switch_and_open',
        residenceId: R1,
        routes,
      });
    });

    it(`${type} : résidence dont on n’est pas membre → accueil, sans erreur`, () => {
      expect(planNotificationNavigation(target, R2, [R2])).toEqual({ kind: 'home' });
      expect(planNotificationNavigation(target, R1, [])).toEqual({ kind: 'home' });
    });
  }
});

describe('notification locale de test', () => {
  it('mêmes données qu’une vraie notification pour chaque type : le toucher ouvre le bon écran', () => {
    for (const type of NOTIFICATION_TYPES) {
      const local = simulatedNotification({ type, residenceId: R1, itemId: ITEM, language: 'fr' });
      expect(local.data).toEqual({ type, residenceId: R1, itemId: ITEM });
      const parsed = parseNotificationTarget(local.data);
      expect(parsed, type).toEqual({ type, residenceId: R1, itemId: ITEM });
      expect(planNotificationNavigation(parsed!, R1, [R1])).toEqual({
        kind: 'open',
        routes: notificationRoutes(parsed!),
      });
    }
  });

  it('sans identifiant (rappel, paiement sans reçu) : seulement type et résidence', () => {
    const local = simulatedNotification({
      type: 'charge_reminder',
      residenceId: R1,
      language: 'fr',
    });
    expect(local.data).toEqual({ type: 'charge_reminder', residenceId: R1 });
    expect(notificationRoutes(parseNotificationTarget(local.data)!)).toEqual([
      { pathname: '/my-charges' },
    ]);
  });

  it('texte générique identique à celui de l’API, en français et en arabe, sans chiffre ni nom', () => {
    const fr = (type: (typeof NOTIFICATION_TYPES)[number]) =>
      simulatedNotification({ type, residenceId: R1, language: 'fr' });
    const ar = (type: (typeof NOTIFICATION_TYPES)[number]) =>
      simulatedNotification({ type, residenceId: R1, language: 'ar' });
    expect(fr('announcement')).toMatchObject({
      title: 'SyndicApp',
      body: 'Nouvelle annonce dans votre résidence',
    });
    expect(fr('announcement_urgent').body).toBe('Annonce urgente dans votre résidence');
    expect(fr('issue_status').body).toBe('Votre signalement a été mis à jour');
    expect(fr('issue_urgent').body).toBe('Nouveau signalement urgent dans votre résidence');
    expect(fr('charge_reminder').body).toBe('Un rappel de charges vous attend dans SyndicApp');
    expect(fr('payment_received').body).toBe('Votre paiement a bien été enregistré');
    expect(ar('announcement').body).toBe('إعلان جديد في إقامتك');
    expect(ar('issue_status').body).toBe('تم تحديث بلاغك');
    expect(ar('issue_urgent').body).toBe('بلاغ عاجل جديد في إقامتك');
    expect(ar('charge_reminder').body).toBe('تذكير بالتكاليف ينتظرك في SyndicApp');
    expect(ar('payment_received').body).toBe('تم تسجيل دفعتك');
    for (const type of NOTIFICATION_TYPES) {
      for (const local of [fr(type), ar(type)]) {
        expect(local.body).not.toMatch(/[0-9٠-٩]/);
        expect(Object.keys(local.data).sort()).toEqual(['residenceId', 'type']);
      }
    }
  });

  it('le bouton de simulation n’existe qu’en développement et propose chaque type', () => {
    expect(showNotificationSimulation(true)).toBe(true);
    expect(showNotificationSimulation(false)).toBe(false);
    expect(notificationsScreenSource).toMatch(
      /__DEV__ && active !== null && <SimulateNotificationButton/,
    );
    expect(simulateButtonSource).toContain('NOTIFICATION_TYPES.map');
  });
});

describe('élément joint à la notification de test', () => {
  const get =
    (responses: Record<string, unknown>) =>
    async <T>(path: string): Promise<T> => {
      if (!(path in responses)) throw new Error('route inconnue');
      return responses[path] as T;
    };

  it('annonce : la plus récente ; signalement : le plus récent ; rien à ouvrir → undefined', async () => {
    const full = get({
      '/api/announcements/latest': { announcement: { id: 'A' } },
      '/api/issues?limit=1': { items: [{ id: 'I' }] },
    });
    expect(await simulationItemId('announcement', full)).toBe('A');
    expect(await simulationItemId('announcement_urgent', full)).toBe('A');
    expect(await simulationItemId('issue_status', full)).toBe('I');
    expect(await simulationItemId('issue_urgent', full)).toBe('I');
    const empty = get({
      '/api/announcements/latest': { announcement: null },
      '/api/issues?limit=1': { items: [] },
    });
    expect(await simulationItemId('announcement', empty)).toBeUndefined();
    expect(await simulationItemId('issue_status', empty)).toBeUndefined();
  });

  it('rappel : aucun identifiant ; paiement : reçu du dernier paiement non annulé, sinon aucun (jamais d’échec)', async () => {
    expect(await simulationItemId('charge_reminder', get({}))).toBeNull();
    const dues = {
      '/api/me/dues': {
        dues: [
          {
            payments: [
              { receiptId: 'R0', cancelledAt: 'x' },
              { receiptId: 'R1', cancelledAt: null },
            ],
          },
        ],
      },
    };
    expect(await simulationItemId('payment_received', get(dues))).toBe('R1');
    expect(
      await simulationItemId('payment_received', get({ '/api/me/dues': { dues: [] } })),
    ).toBeNull();
    expect(await simulationItemId('payment_received', get({}))).toBeNull(); // route refusée : « Mes charges » seulement
  });
});
