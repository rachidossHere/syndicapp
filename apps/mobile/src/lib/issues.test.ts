import { describe, expect, it } from 'vitest';

import { fr } from '../i18n/fr';
import { translate } from '../i18n/translate';
import {
  ageOf,
  canCommentOn,
  canShowReopen,
  canUseIssues,
  clockOf,
  dayRelation,
  eventActorKey,
  eventTitleKey,
  filterCount,
  filterStatuses,
  issueFieldsFrom,
  issueFormSchema,
  issuesResidenceId,
  mergeIssues,
  newestFirst,
  sortIssues,
  type IssueCounts,
  type IssueEvent,
  type IssueFormValues,
  type IssueItem,
} from './issues';

const issue = (overrides: Partial<IssueItem> & { id: string }): IssueItem => ({
  title: 'Titre',
  description: null,
  location: 'elevator',
  urgent: false,
  status: 'open',
  hasPhoto: false,
  photoContentType: null,
  photoSize: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
  resolvedAt: null,
  byYou: false,
  ...overrides,
});

const event = (overrides: Partial<IssueEvent>): IssueEvent => ({
  id: 'e1',
  type: 'comment',
  fromStatus: null,
  toStatus: null,
  message: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  byYou: false,
  authorRole: null,
  ...overrides,
});

describe('filtres « En cours » et « Résolus »', () => {
  const counts: IssueCounts = { open: 2, in_progress: 1, resolved: 12, urgentUnresolved: 1 };

  it('« En cours » regroupe ouverts et en cours, « Résolus » les résolus', () => {
    expect(filterStatuses('active')).toEqual(['open', 'in_progress']);
    expect(filterStatuses('resolved')).toEqual(['resolved']);
  });

  it('les compteurs suivent les filtres : 3 en cours, 12 résolus', () => {
    expect(filterCount('active', counts)).toBe(3);
    expect(filterCount('resolved', counts)).toBe(12);
    expect(translate('fr', 'issues.filter.active', { count: 3 })).toBe('En cours · 3');
    expect(translate('fr', 'issues.filter.resolved', { count: 12 })).toBe('Résolus · 12');
  });
});

describe('ordre de la liste', () => {
  it('les urgents non résolus passent en premier, puis du plus récent au plus ancien', () => {
    const list = sortIssues([
      issue({ id: 'a', createdAt: '2026-11-12T10:00:00.000Z' }),
      issue({ id: 'b', urgent: true, createdAt: '2026-11-01T10:00:00.000Z' }),
      issue({ id: 'c', createdAt: '2026-11-13T10:00:00.000Z' }),
      issue({ id: 'd', urgent: true, status: 'in_progress', createdAt: '2026-11-05T10:00:00.000Z' }),
    ]);
    expect(list.map((item) => item.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('un urgent déjà résolu ne passe plus devant les autres', () => {
    const list = sortIssues([
      issue({ id: 'old', createdAt: '2026-11-01T10:00:00.000Z' }),
      issue({ id: 'resolved-urgent', urgent: true, status: 'resolved', createdAt: '2026-11-02T10:00:00.000Z' }),
      issue({ id: 'new-urgent', urgent: true, createdAt: '2026-10-01T10:00:00.000Z' }),
    ]);
    expect(list.map((item) => item.id)).toEqual(['new-urgent', 'resolved-urgent', 'old']);
  });

  it('« En cours » fusionne ouverts et en cours sans doublon, urgents d’abord', () => {
    const open = [issue({ id: 'u', urgent: true, createdAt: '2026-11-01T10:00:00.000Z' }), issue({ id: 'o', createdAt: '2026-11-11T10:00:00.000Z' })];
    const inProgress = [
      issue({ id: 'p', status: 'in_progress', createdAt: '2026-11-12T10:00:00.000Z' }),
      issue({ id: 'o', createdAt: '2026-11-11T10:00:00.000Z' }),
    ];
    expect(mergeIssues([open, inProgress]).map((item) => item.id)).toEqual(['u', 'p', 'o']);
  });

  it('ne modifie pas la liste reçue', () => {
    const input = [issue({ id: 'a' }), issue({ id: 'b', urgent: true })];
    sortIssues(input);
    expect(input.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('commentaire et réouverture (auteur seulement)', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');
  const resolved = (resolvedAt: string, overrides = {}) => ({
    byYou: true,
    canReopen: true,
    status: 'resolved' as const,
    resolvedAt,
    ...overrides,
  });

  it('le champ de commentaire n’est proposé qu’à l’auteur', () => {
    expect(canCommentOn({ byYou: true })).toBe(true);
    expect(canCommentOn({ byYou: false })).toBe(false);
  });

  it('« Rouvrir » : auteur, résolu depuis moins de 7 jours', () => {
    expect(canShowReopen(resolved('2026-11-12T12:00:00.000Z'), now)).toBe(true);
    // Pile 7 jours : encore permis (comme l'API).
    expect(canShowReopen(resolved('2026-11-07T12:00:00.000Z'), now)).toBe(true);
  });

  it('« Rouvrir » : pas après 7 jours, même si l’API (en cache) le disait', () => {
    expect(canShowReopen(resolved('2026-11-07T11:59:00.000Z'), now)).toBe(false);
  });

  it('« Rouvrir » : jamais pour un autre habitant', () => {
    expect(canShowReopen(resolved('2026-11-13T12:00:00.000Z', { byYou: false }), now)).toBe(false);
  });

  it('« Rouvrir » : jamais si l’API ne l’autorise pas ou si le signalement n’est pas résolu', () => {
    expect(canShowReopen(resolved('2026-11-13T12:00:00.000Z', { canReopen: false }), now)).toBe(false);
    expect(canShowReopen(resolved('2026-11-13T12:00:00.000Z', { status: 'open' }), now)).toBe(false);
    expect(canShowReopen({ byYou: true, canReopen: true, status: 'resolved', resolvedAt: null }, now)).toBe(false);
  });
});

describe('auteur d’un événement de l’historique', () => {
  it('« vous » pour mes propres actions', () => {
    const key = eventActorKey(event({ byYou: true }));
    expect(key).toBe('issues.actor.you');
    expect(translate('fr', key)).toBe('vous');
  });

  it('« le syndic » et « le gardien » pour le personnel', () => {
    expect(translate('fr', eventActorKey(event({ authorRole: 'manager' })))).toBe('le syndic');
    expect(translate('fr', eventActorKey(event({ authorRole: 'caretaker' })))).toBe('le gardien');
  });

  it('un autre habitant n’est jamais nommé : « un habitant »', () => {
    for (const authorRole of [null, 'owner', 'tenant'] as const) {
      expect(eventActorKey(event({ authorRole }))).toBe('issues.actor.resident');
    }
    expect(translate('fr', 'issues.actor.resident')).toBe('un habitant');
  });

  it('l’intitulé suit le type : Signalé, statut, Commentaire, Rouvert', () => {
    expect(translate('fr', eventTitleKey(event({ type: 'created' })))).toBe('Signalé');
    expect(translate('fr', eventTitleKey(event({ type: 'status_changed', toStatus: 'in_progress' })))).toBe('En cours');
    expect(translate('fr', eventTitleKey(event({ type: 'status_changed', toStatus: 'resolved' })))).toBe('Résolu');
    expect(translate('fr', eventTitleKey(event({ type: 'comment' })))).toBe('Commentaire');
    expect(translate('fr', eventTitleKey(event({ type: 'reopened' })))).toBe('Rouvert');
  });

  it('l’historique s’affiche du plus récent au plus ancien', () => {
    const events = [event({ id: '1' }), event({ id: '2' }), event({ id: '3' })];
    expect(newestFirst(events).map((item) => item.id)).toEqual(['3', '2', '1']);
    expect(events.map((item) => item.id)).toEqual(['1', '2', '3']);
  });
});

describe('formulaire « Signaler un problème »', () => {
  const valid: IssueFormValues = { title: 'Lampe grillée escalier B', location: 'stairs', description: '', urgent: false };
  const errorsOf = (values: IssueFormValues) => {
    const result = issueFormSchema.safeParse(values);
    return result.success ? {} : Object.fromEntries(result.error.issues.map((item) => [String(item.path[0]), item.message]));
  };

  it('accepte un titre et un emplacement, détails et photo facultatifs', () => {
    expect(issueFormSchema.safeParse(valid).success).toBe(true);
    expect(issueFieldsFrom(valid)).toEqual({ title: 'Lampe grillée escalier B', location: 'stairs', urgent: false });
  });

  it('le titre est obligatoire, sans espaces seuls', () => {
    expect(errorsOf({ ...valid, title: '' })).toEqual({ title: 'issues.errors.titleRequired' });
    expect(errorsOf({ ...valid, title: '   ' })).toEqual({ title: 'issues.errors.titleRequired' });
  });

  it('le titre est limité à 120 caractères', () => {
    expect(errorsOf({ ...valid, title: 'x'.repeat(121) })).toEqual({ title: 'issues.errors.titleTooLong' });
    expect(errorsOf({ ...valid, title: 'x'.repeat(120) })).toEqual({});
  });

  it('l’emplacement est obligatoire', () => {
    expect(errorsOf({ ...valid, location: '' })).toEqual({ location: 'issues.errors.locationRequired' });
  });

  it('les détails sont limités à 2 000 caractères, vides acceptés', () => {
    expect(errorsOf({ ...valid, description: 'x'.repeat(2001) })).toEqual({ description: 'issues.errors.descriptionTooLong' });
    expect(errorsOf({ ...valid, description: '   ' })).toEqual({});
    expect(issueFieldsFrom({ ...valid, description: '  Côté porte.  ' })?.description).toBe('Côté porte.');
  });

  it('plusieurs erreurs sont signalées ensemble, sous chaque champ', () => {
    expect(errorsOf({ title: '', location: '', description: '', urgent: false })).toEqual({
      title: 'issues.errors.titleRequired',
      location: 'issues.errors.locationRequired',
    });
  });

  it('reprend l’interrupteur « C’est urgent »', () => {
    expect(issueFieldsFrom({ ...valid, urgent: true })?.urgent).toBe(true);
  });

  it('une saisie invalide ne produit aucun champ à envoyer', () => {
    expect(issueFieldsFrom({ ...valid, title: '' })).toBeUndefined();
  });

  it('toutes les erreurs du formulaire sont des clés traduites', () => {
    for (const key of ['titleRequired', 'titleTooLong', 'locationRequired', 'descriptionTooLong']) {
      expect(fr[`issues.errors.${key}` as keyof typeof fr]).toBeTruthy();
    }
  });
});

describe('accès', () => {
  it('tous les rôles peuvent signaler : gardien et locataire compris', () => {
    for (const role of ['manager', 'treasurer', 'deputy', 'owner', 'tenant', 'caretaker'] as const) {
      expect(canUseIssues(role), role).toBe(true);
      expect(issuesResidenceId({ id: 'r1', role }), role).toBe('r1');
    }
  });

  it('sans résidence active, aucune requête', () => {
    expect(issuesResidenceId(null)).toBeUndefined();
    expect(canUseIssues(undefined)).toBe(false);
  });
});

describe('dates (Africa/Casablanca)', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  it('l’âge : à l’instant, minutes, heures, hier, date', () => {
    expect(ageOf('2026-11-14T11:59:50.000Z', now)).toEqual({ kind: 'now' });
    expect(ageOf('2026-11-14T11:30:00.000Z', now)).toEqual({ kind: 'minutes', count: 30 });
    expect(ageOf('2026-11-14T10:00:00.000Z', now)).toEqual({ kind: 'hours', count: 2 });
    expect(ageOf('2026-11-13T10:00:00.000Z', now)).toEqual({ kind: 'yesterday' });
    expect(ageOf('2026-11-03T10:00:00.000Z', now)).toEqual({ kind: 'date', date: '2026-11-03' });
  });

  it('aujourd’hui, hier ou une autre date', () => {
    expect(dayRelation('2026-11-14T08:00:00.000Z', now)).toBe('today');
    expect(dayRelation('2026-11-13T08:00:00.000Z', now)).toBe('yesterday');
    expect(dayRelation('2026-11-01T08:00:00.000Z', now)).toBe('other');
  });

  it('l’heure est celle du Maroc (UTC+1 en novembre)', () => {
    expect(clockOf('2026-11-14T08:10:00.000Z')).toEqual({ hour: 9, minute: 10 });
  });
});
