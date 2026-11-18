import { ROLES, type AnnouncementItem } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_FILTERS,
  announcementFilterLabelKey,
  filterAnnouncements,
  needsMoreForFilter,
  ANNOUNCEMENT_FORM_ERRORS,
  CATEGORY_TONES,
  DEFAULT_ANNOUNCEMENT_FORM,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  announcementFormSchema,
  announcementInputFrom,
  announcementWhen,
  announcementsResidenceId,
  audienceNoteKey,
  authorLabelKey,
  canPublishAnnouncement,
  canSubmitAnnouncement,
  categoryLabelKey,
  latestAnnouncementToShow,
  mergeAnnouncementPages,
  type AnnouncementFormValues,
} from './announcements';

const valid: AnnouncementFormValues = { category: 'works', title: 'Coupure d’eau jeudi 20 nov.', body: 'De 9 h à 13 h.', pinned: false };

const item = (id: string, extra: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id,
  category: 'info',
  title: `Annonce ${id}`,
  body: 'Texte',
  pinned: false,
  pinnedAt: null,
  createdAt: '2026-11-18T08:30:00.000Z',
  authorRole: 'manager',
  byYou: false,
  ...extra,
});

describe('formulaire « Nouvelle annonce »', () => {
  it('valeurs de départ : Travaux présélectionné, rien d’épinglé, formulaire invalide (bouton désactivé)', () => {
    expect(DEFAULT_ANNOUNCEMENT_FORM).toEqual({ category: 'works', title: '', body: '', pinned: false });
    expect(canSubmitAnnouncement(DEFAULT_ANNOUNCEMENT_FORM)).toBe(false);
  });

  it('bouton actif seulement si titre et message sont valides', () => {
    expect(canSubmitAnnouncement(valid)).toBe(true);
    expect(canSubmitAnnouncement({ ...valid, title: '' })).toBe(false);
    expect(canSubmitAnnouncement({ ...valid, title: '    ' })).toBe(false);
    expect(canSubmitAnnouncement({ ...valid, body: '' })).toBe(false);
    expect(canSubmitAnnouncement({ ...valid, body: '  \n ' })).toBe(false);
  });

  it('limites : 80 caractères pour le titre, 1000 pour le message', () => {
    expect(canSubmitAnnouncement({ ...valid, title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH) })).toBe(true);
    expect(canSubmitAnnouncement({ ...valid, title: 'a'.repeat(MAX_ANNOUNCEMENT_TITLE_LENGTH + 1) })).toBe(false);
    expect(canSubmitAnnouncement({ ...valid, body: 'a'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH) })).toBe(true);
    expect(canSubmitAnnouncement({ ...valid, body: 'a'.repeat(MAX_ANNOUNCEMENT_BODY_LENGTH + 1) })).toBe(false);
  });

  it('chaque catégorie est acceptée', () => {
    for (const category of ANNOUNCEMENT_CATEGORIES) expect(canSubmitAnnouncement({ ...valid, category })).toBe(true);
  });

  it('erreurs traduites : titre ou message vide, titre ou message trop long', () => {
    const errors = (values: AnnouncementFormValues) => {
      const result = announcementFormSchema.safeParse(values);
      return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    };
    expect(errors({ ...valid, title: '' })).toEqual({ title: ANNOUNCEMENT_FORM_ERRORS.titleRequired });
    expect(errors({ ...valid, body: '' })).toEqual({ body: ANNOUNCEMENT_FORM_ERRORS.bodyRequired });
    expect(errors({ ...valid, title: 'a'.repeat(81) })).toEqual({ title: ANNOUNCEMENT_FORM_ERRORS.titleTooLong });
    expect(errors({ ...valid, body: 'a'.repeat(1001) })).toEqual({ body: ANNOUNCEMENT_FORM_ERRORS.bodyTooLong });
    expect(errors(valid)).toEqual({});
  });

  it('le corps envoyé est nettoyé (espaces retirés) ; invalide : rien n’est envoyé', () => {
    expect(announcementInputFrom({ ...valid, title: '  Titre  ', pinned: true })).toEqual({
      category: 'works',
      title: 'Titre',
      body: 'De 9 h à 13 h.',
      pinned: true,
    });
    expect(announcementInputFrom({ ...valid, title: '' })).toBeUndefined();
  });
});

describe('accès par rôle (écran 4 visible seulement avec announcements.write)', () => {
  it('seuls le syndic et l’adjoint publient ; sans rôle, personne', () => {
    for (const role of ROLES) expect(canPublishAnnouncement(role)).toBe(role === 'manager' || role === 'deputy');
    expect(canPublishAnnouncement(undefined)).toBe(false);
  });

  it('la liste des annonces est celle de la résidence active, pour tous les rôles', () => {
    expect(announcementsResidenceId({ id: 'r1' })).toBe('r1');
    expect(announcementsResidenceId(null)).toBeUndefined();
  });
});

describe('carte « Dernière annonce » de l’accueil', () => {
  it('cachée sans annonce, pendant le chargement et en cas d’erreur ; affichée sinon', () => {
    expect(latestAnnouncementToShow(null)).toBeNull();
    expect(latestAnnouncementToShow(undefined)).toBeNull();
    const latest = item('a1');
    expect(latestAnnouncementToShow(latest)).toBe(latest);
  });
});

describe('présentation', () => {
  it('chaque catégorie a un ton et un libellé traduit', () => {
    expect(CATEGORY_TONES).toEqual({ works: 'warning', meeting: 'success', info: 'info', urgent: 'danger' });
    for (const category of ANNOUNCEMENT_CATEGORIES) expect(categoryLabelKey(category)).toBe(`announcements.category.${category}`);
  });

  it('l’auteur est désigné par son rôle : « Le syndic », « L’adjoint », sinon rien', () => {
    expect(authorLabelKey('manager')).toBe('announcements.author.manager');
    expect(authorLabelKey('deputy')).toBe('announcements.author.deputy');
    expect(authorLabelKey('owner')).toBeUndefined();
    expect(authorLabelKey(null)).toBeUndefined();
  });

  it('date : aujourd’hui avec l’heure de Casablanca, hier, ou la date', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    expect(announcementWhen('2026-11-18T07:30:00.000Z', now)).toMatchObject({ kind: 'today' });
    expect(announcementWhen('2026-11-17T10:00:00.000Z', now)).toEqual({ kind: 'yesterday' });
    expect(announcementWhen('2026-11-10T10:00:00.000Z', now)).toEqual({ kind: 'date', date: '2026-11-10' });
  });

  it('texte « Les N membres seront prévenus » : inconnu, aucun, singulier, pluriel', () => {
    expect(audienceNoteKey(undefined)).toBe('announcements.audience.unknown');
    expect(audienceNoteKey(0)).toBe('announcements.audience.none');
    expect(audienceNoteKey(1)).toBe('announcements.audience.one');
    expect(audienceNoteKey(2)).toBe('announcements.audience.other');
    expect(audienceNoteKey(24)).toBe('announcements.audience.other');
  });
});

describe('pagination', () => {
  it('une annonce revue d’une page à l’autre n’est affichée qu’une fois, l’ordre de l’API est gardé', () => {
    const merged = mergeAnnouncementPages([
      { items: [item('a'), item('b')] },
      { items: [item('b'), item('c')] },
      { items: [] },
    ]);
    expect(merged.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('filtres par catégorie', () => {
  const items = [
    { ...item('a1'), category: 'works' as const },
    { ...item('a2'), category: 'urgent' as const },
    { ...item('a3'), category: 'works' as const },
  ];

  it('Toutes, puis une puce par catégorie, avec leurs libellés', () => {
    expect([...ANNOUNCEMENT_FILTERS]).toEqual(['all', 'works', 'meeting', 'info', 'urgent']);
    expect(announcementFilterLabelKey('all')).toBe('announcements.filter.all');
    expect(announcementFilterLabelKey('meeting')).toBe('announcements.category.meeting');
  });

  it('Toutes garde tout dans l’ordre ; une catégorie ne garde que ses annonces', () => {
    expect(filterAnnouncements(items, 'all').map((i) => i.id)).toEqual(['a1', 'a2', 'a3']);
    expect(filterAnnouncements(items, 'works').map((i) => i.id)).toEqual(['a1', 'a3']);
    expect(filterAnnouncements(items, 'info')).toEqual([]);
  });

  it('charge la suite seulement si un filtre est choisi, que rien ne correspond et qu’il reste des pages', () => {
    const base = { filter: 'info' as const, shown: 0, hasNextPage: true, busy: false };
    expect(needsMoreForFilter(base)).toBe(true);
    expect(needsMoreForFilter({ ...base, filter: 'all' })).toBe(false);
    expect(needsMoreForFilter({ ...base, shown: 2 })).toBe(false);
    expect(needsMoreForFilter({ ...base, hasNextPage: false })).toBe(false);
    expect(needsMoreForFilter({ ...base, busy: true })).toBe(false);
  });
});
