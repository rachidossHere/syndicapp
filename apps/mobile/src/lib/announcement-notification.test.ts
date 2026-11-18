import { describe, expect, it } from 'vitest';

import notificationsScreenSource from '../features/notifications/notifications-screen.tsx?raw';
import {
  parseAnnouncementNotification,
  planAnnouncementNavigation,
  showNotificationSimulation,
  simulatedAnnouncementNotification,
} from './announcement-notification';

const R1 = '0b5f0c8e-1c1e-4c8e-9a53-6f1d2a7b9c10';
const R2 = '7a1d5b6e-2f3c-4d8a-8b9e-1c2d3e4f5a6b';
const A1 = '5d2c1b3a-9e8f-4a7b-a6c5-d4e3f2a1b0c9';

describe('lecture des données d’une notification d’annonce', () => {
  it('annonce ordinaire ou urgente : résidence et annonce', () => {
    for (const type of ['announcement', 'announcement_urgent']) {
      expect(parseAnnouncementNotification({ type, residenceId: R1, itemId: A1 })).toEqual({ residenceId: R1, announcementId: A1 });
    }
  });

  it('autre type de notification, données absentes ou invalides : ignorées (null)', () => {
    expect(parseAnnouncementNotification({ type: 'issue_status', residenceId: R1, itemId: A1 })).toBeNull();
    expect(parseAnnouncementNotification({ type: 'announcement', residenceId: 'pas-un-uuid', itemId: A1 })).toBeNull();
    expect(parseAnnouncementNotification({ type: 'announcement', residenceId: R1 })).toBeNull();
    expect(parseAnnouncementNotification({ type: 'announcement', residenceId: R1, itemId: 42 })).toBeNull();
    expect(parseAnnouncementNotification(null)).toBeNull();
    expect(parseAnnouncementNotification(undefined)).toBeNull();
    expect(parseAnnouncementNotification('announcement')).toBeNull();
  });
});

describe('navigation au toucher d’une notification d’annonce', () => {
  const target = { residenceId: R1, announcementId: A1 };

  it('résidence active : le détail s’ouvre directement', () => {
    expect(planAnnouncementNavigation(target, R1, [R1, R2])).toEqual({ kind: 'open', announcementId: A1 });
  });

  it('autre résidence dont on est membre : bascule d’abord, puis détail', () => {
    expect(planAnnouncementNavigation(target, R2, [R1, R2])).toEqual({
      kind: 'switch_and_open',
      residenceId: R1,
      announcementId: A1,
    });
    // Aucune résidence active mémorisée : même chose.
    expect(planAnnouncementNavigation(target, null, [R1])).toEqual({ kind: 'switch_and_open', residenceId: R1, announcementId: A1 });
  });

  it('résidence dont on n’est pas membre : l’accueil, sans erreur (même si elle est la résidence active mémorisée)', () => {
    expect(planAnnouncementNavigation(target, R2, [R2])).toEqual({ kind: 'home' });
    expect(planAnnouncementNavigation(target, R1, [])).toEqual({ kind: 'home' });
    expect(planAnnouncementNavigation(target, null, [])).toEqual({ kind: 'home' });
  });
});

describe('notification locale de test', () => {
  it('mêmes données qu’une vraie notification (type, résidence, annonce) : le toucher ouvre le détail', () => {
    const local = simulatedAnnouncementNotification({ residenceId: R1, announcementId: A1, language: 'fr' });
    expect(local.data).toEqual({ type: 'announcement', residenceId: R1, itemId: A1 });
    expect(parseAnnouncementNotification(local.data)).toEqual({ residenceId: R1, announcementId: A1 });
    expect(planAnnouncementNavigation(parseAnnouncementNotification(local.data)!, R1, [R1])).toEqual({ kind: 'open', announcementId: A1 });
  });

  it('texte générique identique à celui de l’API, en français et en arabe, jamais le titre de l’annonce', () => {
    expect(simulatedAnnouncementNotification({ residenceId: R1, announcementId: A1, language: 'fr' })).toMatchObject({
      title: 'SyndicApp',
      body: 'Nouvelle annonce dans votre résidence',
    });
    expect(simulatedAnnouncementNotification({ residenceId: R1, announcementId: A1, language: 'ar' }).body).toBe('إعلان جديد في إقامتك');
    const urgent = simulatedAnnouncementNotification({ residenceId: R1, announcementId: A1, language: 'fr', urgent: true });
    expect(urgent.body).toBe('Annonce urgente dans votre résidence');
    expect(urgent.data.type).toBe('announcement_urgent');
    expect(Object.keys(urgent.data).sort()).toEqual(['itemId', 'residenceId', 'type']);
  });

  it('le bouton de simulation n’existe qu’en développement', () => {
    expect(showNotificationSimulation(true)).toBe(true);
    expect(showNotificationSimulation(false)).toBe(false);
  });

  it('dans l’écran Notifications, le bouton n’est rendu que sous __DEV__ (absent d’une version de production)', () => {
    const source = notificationsScreenSource;
    const uses = source.match(/<SimulateAnnouncementButton/g) ?? [];
    expect(uses).toHaveLength(1);
    expect(source).toMatch(/\{__DEV__ && [^\n]*<SimulateAnnouncementButton/);
  });
});
