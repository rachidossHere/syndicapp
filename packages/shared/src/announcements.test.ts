import { describe, expect, it } from 'vitest';

import {
  ANNOUNCEMENT_CATEGORIES,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  announcementListQuerySchema,
  announcementNotificationType,
  createAnnouncementSchema,
  pinAnnouncementSchema,
} from './announcements';
import { can, ROLES } from './roles';

const valid = { category: 'works', title: 'Coupure d’eau jeudi 20 nov.', body: 'De 9 h à 13 h.' };

describe('annonces : publication', () => {
  it('accepte une annonce valide, non épinglée par défaut', () => {
    expect(createAnnouncementSchema.parse(valid)).toEqual({ ...valid, pinned: false });
    expect(createAnnouncementSchema.parse({ ...valid, pinned: true }).pinned).toBe(true);
  });

  it('refuse une catégorie inconnue, un titre ou un texte vide, un champ en trop', () => {
    expect(createAnnouncementSchema.safeParse({ ...valid, category: 'party' }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...valid, body: '' }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...valid, authorId: 'x' }).success).toBe(false);
  });

  it('limites : 80 caractères pour le titre, 1000 pour le texte', () => {
    expect(createAnnouncementSchema.safeParse({ ...valid, title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH) }).success).toBe(true);
    expect(createAnnouncementSchema.safeParse({ ...valid, title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH + 1) }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...valid, body: 'a'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH) }).success).toBe(true);
    expect(createAnnouncementSchema.safeParse({ ...valid, body: 'a'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH + 1) }).success).toBe(false);
    expect(MAX_ANNOUNCEMENT_TITLE_LENGTH).toBe(80);
    expect(MAX_ANNOUNCEMENT_BODY_LENGTH).toBe(1000);
  });
});

describe('annonces : épinglage et liste', () => {
  it('épinglage : un booléen obligatoire', () => {
    expect(pinAnnouncementSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(pinAnnouncementSchema.safeParse({}).success).toBe(false);
    expect(pinAnnouncementSchema.safeParse({ pinned: 'oui' }).success).toBe(false);
  });

  it('liste : limite bornée, 20 par défaut, paramètre inconnu refusé', () => {
    expect(announcementListQuerySchema.parse({}).limit).toBe(20);
    expect(announcementListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(announcementListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(announcementListQuerySchema.safeParse({ offset: '1' }).success).toBe(false);
  });
});

describe('annonces : type de notification et permission', () => {
  it('urgent → announcement_urgent (non désactivable), les autres → announcement', () => {
    for (const category of ANNOUNCEMENT_CATEGORIES) {
      expect(announcementNotificationType(category)).toBe(category === 'urgent' ? 'announcement_urgent' : 'announcement');
    }
  });

  it('announcements.write : syndic et adjoint seulement', () => {
    for (const role of ROLES) expect(can(role, 'announcements.write')).toBe(['manager', 'deputy'].includes(role));
  });
});
