// Signalements côté habitant (plan 07, étape 2) : types des réponses de l'API, filtres, tri,
// règles d'affichage (commentaire, réouverture, auteur d'un événement), validation du formulaire
// et formatage des dates. Fonctions pures, sans React : testées avec vitest.
import {
  ISSUE_LOCATIONS,
  ISSUE_STATUSES,
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_MESSAGE_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  can,
  createIssueSchema,
  isWithinReopenWindow,
  type CreateIssueInput,
  type IssueCountsResponse,
  type IssueEventType,
  type IssueLocation,
  type IssueStatus,
  type Role,
} from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

import { casablancaDate } from './charges-format';

// ---------------------------------------------------------------------------------------------
// Réponses de l'API (apps/api/src/routes/issues.ts)

export type IssueItem = {
  id: string;
  title: string;
  description: string | null;
  location: IssueLocation;
  urgent: boolean;
  status: IssueStatus;
  hasPhoto: boolean;
  photoContentType: string | null;
  photoSize: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  /** Vrai si le lecteur est l'auteur : le seul indice donné à un habitant. */
  byYou: boolean;
  /** Réservé aux rôles avec `issues.manage` : jamais envoyé à un habitant. */
  author?: { name: string | null; lot: string | null };
};

export type IssueEvent = {
  id: string;
  type: IssueEventType;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus | null;
  message: string | null;
  createdAt: string;
  byYou: boolean;
  /** Rôle du personnel qui a agi (jamais celui de l'auteur du signalement pour un habitant). */
  authorRole: Role | null;
  /** Réservé aux rôles avec `issues.manage` : jamais envoyé à un habitant. */
  authorName?: string | null;
};

export type IssueDetail = IssueItem & {
  canReopen: boolean;
  /** Du plus ancien au plus récent (ordre de l'API) ; l'écran les affiche à l'envers. */
  events: IssueEvent[];
};

/** GET /api/issues/counts : par statut, et urgents non résolus. */
export type IssueCounts = IssueCountsResponse;

export type IssueListPage = {
  items: IssueItem[];
  total: number;
  limit: number;
  offset: number;
};

// ---------------------------------------------------------------------------------------------
// Accès

/** Tous les rôles peuvent signaler (`issues.write`) : l'entrée est visible pour chacun. */
export const canUseIssues = (role: Role | undefined): boolean => role !== undefined && can(role, 'issues.write');

/** Résidence pour laquelle l'écran des signalements charge ses données (aucune requête sinon). */
export function issuesResidenceId(active: { id: string; role: Role } | null): string | undefined {
  return active !== null && canUseIssues(active.role) ? active.id : undefined;
}

// ---------------------------------------------------------------------------------------------
// Vue selon le rôle, filtres

/** Vue de la liste et du détail : « traitement » (issues.manage) ou « habitant » (les autres rôles). */
export type IssuesView = 'manage' | 'resident';
export const issuesViewFor = (role: Role | undefined): IssuesView =>
  role !== undefined && can(role, 'issues.manage') ? 'manage' : 'resident';

/** Habitant : « En cours » (ouverts et en cours de traitement) et « Résolus ». */
export const RESIDENT_FILTERS = ['active', 'resolved'] as const;
/** Syndic, adjoint, gardien : Tous, Ouverts, En cours, Résolus. */
export const MANAGE_FILTERS = ['all', 'open', 'in_progress', 'resolved'] as const;
export type IssueFilter = (typeof RESIDENT_FILTERS)[number] | (typeof MANAGE_FILTERS)[number];

export const filtersFor = (view: IssuesView): readonly IssueFilter[] =>
  view === 'manage' ? MANAGE_FILTERS : RESIDENT_FILTERS;
export const defaultFilterFor = (view: IssuesView): IssueFilter => (view === 'manage' ? 'all' : 'active');

/** Statuts d'un filtre ; `undefined` pour « Tous » (aucun filtre). */
export function filterStatuses(filter: IssueFilter): readonly IssueStatus[] | undefined {
  switch (filter) {
    case 'all':
      return undefined;
    case 'active':
      return ['open', 'in_progress'];
    default:
      return [filter];
  }
}

/** Valeur du paramètre `status` de GET /api/issues (« open,in_progress »), absente pour « Tous ». */
export const filterStatusParam = (filter: IssueFilter): string | undefined => filterStatuses(filter)?.join(',');

/** Compteur d'un filtre, à partir des compteurs de la résidence. */
export function filterCount(filter: IssueFilter, counts: IssueCounts): number {
  const statuses = filterStatuses(filter) ?? ISSUE_STATUSES;
  return statuses.reduce((sum, status) => sum + counts[status], 0);
}

/** Texte du bandeau « N signalement(s) urgent(s) à traiter » : singulier pour 1, pluriel sinon. */
export const urgentBannerKey = (count: number): TranslationKey =>
  count === 1 ? 'issues.manage.urgentBanner.one' : 'issues.manage.urgentBanner.other';

// ---------------------------------------------------------------------------------------------
// Traitement (écran 5)

export type IssueUpdatePlan =
  | { kind: 'none' }
  | { kind: 'status'; status: IssueStatus; message?: string }
  | { kind: 'comment'; message: string };

/**
 * Ce que fait « Mettre à jour » : le statut a changé → changement de statut (avec le message
 * facultatif) ; sinon un message seul → commentaire visible des habitants ; sinon rien (bouton inactif).
 */
export function planIssueUpdate(current: IssueStatus, selected: IssueStatus, message: string): IssueUpdatePlan {
  const text = message.trim();
  if (selected !== current) {
    return text === '' ? { kind: 'status', status: selected } : { kind: 'status', status: selected, message: text };
  }
  return text === '' ? { kind: 'none' } : { kind: 'comment', message: text };
}

/** « Mettre à jour » n'est actif que si le statut change ou qu'un message est saisi. */
export const canSubmitUpdate = (current: IssueStatus, selected: IssueStatus, message: string): boolean =>
  planIssueUpdate(current, selected, message).kind !== 'none';

/** Entre isolants de gauche à droite : une référence (A12, B-31) reste lisible dans une phrase arabe. */
const ltr = (text: string): string => `⁦${text}⁩`;

/** Ligne d'un signalement pour le personnel : « A12 · Y. Alaoui · il y a 2 h » (parties absentes omises). */
export function staffLineParts(issue: Pick<IssueItem, 'author'>, age: string): string[] {
  const lot = issue.author?.lot;
  const name = issue.author?.name;
  return [...(lot ? [ltr(lot)] : []), ...(name ? [name] : []), age];
}

/** Qui a agi, vu par le personnel : le nom (ou « vous »), l'appartement pour « Signalé », sinon le rôle. */
export function manageEventActor(
  event: Pick<IssueEvent, 'type' | 'byYou' | 'authorRole' | 'authorName'>,
  author: IssueItem['author'],
): { kind: 'text'; text: string } | { kind: 'key'; key: TranslationKey } {
  if (event.byYou) return { kind: 'key', key: 'issues.actor.you' };
  if (event.type === 'created' && author?.lot) return { kind: 'text', text: ltr(author.lot) };
  if (event.authorName) return { kind: 'text', text: event.authorName };
  return { kind: 'key', key: eventActorKey(event) };
}

// ---------------------------------------------------------------------------------------------
// Détail : qui peut faire quoi, et qui a agi

/** Le champ « Ajouter un commentaire » n'est proposé qu'à l'auteur du signalement. */
export const canCommentOn = (issue: Pick<IssueItem, 'byYou'>): boolean => issue.byYou;

/**
 * « Rouvrir » : auteur seulement, signalement résolu depuis moins de 7 jours. L'API le dit
 * (`canReopen`), mais la date est revérifiée ici : un détail resté en cache ne doit pas proposer un
 * bouton que l'API refuserait.
 */
export function canShowReopen(
  issue: Pick<IssueDetail, 'byYou' | 'canReopen' | 'status' | 'resolvedAt'>,
  now: Date = new Date(),
): boolean {
  if (!issue.byYou || !issue.canReopen || issue.status !== 'resolved' || issue.resolvedAt === null) return false;
  return isWithinReopenWindow(new Date(issue.resolvedAt), now);
}

const STAFF_ROLES: readonly Role[] = ['manager', 'treasurer', 'deputy', 'caretaker'];

/**
 * Qui a agi, pour l'historique : « vous », « le syndic », « le gardien »… ou « un habitant ».
 * Jamais le nom d'un autre habitant : l'API n'en envoie pas, et un habitant (auteur ou non) reste
 * anonyme.
 */
export function eventActorKey(event: Pick<IssueEvent, 'byYou' | 'authorRole'>): TranslationKey {
  if (event.byYou) return 'issues.actor.you';
  const role = event.authorRole;
  if (role !== null && STAFF_ROLES.includes(role)) return `issues.actor.${role}` as TranslationKey;
  return 'issues.actor.resident';
}

/** Intitulé d'un événement : « Signalé », « En cours », « Résolu », « Commentaire », « Rouvert ». */
export function eventTitleKey(event: Pick<IssueEvent, 'type' | 'toStatus'>): TranslationKey {
  switch (event.type) {
    case 'created':
      return 'issues.event.created';
    case 'comment':
      return 'issues.event.comment';
    case 'reopened':
      return 'issues.event.reopened';
    case 'status_changed':
      return `issues.status.${event.toStatus ?? 'open'}` as TranslationKey;
  }
}

/** Statut dont la couleur marque l'événement dans le fil. */
export function eventTone(event: Pick<IssueEvent, 'type' | 'toStatus'>): IssueStatus | 'comment' {
  if (event.type === 'comment') return 'comment';
  if (event.type === 'status_changed') return event.toStatus ?? 'open';
  return 'open';
}

/** Historique du plus récent au plus ancien. */
export const newestFirst = (events: readonly IssueEvent[]): IssueEvent[] => [...events].reverse();

// ---------------------------------------------------------------------------------------------
// Formulaire « Signaler un problème »

export type IssueFormValues = {
  title: string;
  location: IssueLocation | '';
  description: string;
  urgent: boolean;
};

export const ISSUE_FORM_ERRORS = {
  titleRequired: 'issues.errors.titleRequired',
  titleTooLong: 'issues.errors.titleTooLong',
  locationRequired: 'issues.errors.locationRequired',
  descriptionTooLong: 'issues.errors.descriptionTooLong',
  uploadFailed: 'issues.errors.uploadFailed',
  cameraDenied: 'issues.errors.cameraDenied',
  pickFailed: 'issues.errors.pickFailed',
} as const;

type Issue = { path: readonly PropertyKey[]; message: string; code: string };
type Fields = Omit<CreateIssueInput, 'photoKey'>;

function issueKey(issue: Issue): string {
  switch (issue.path[0]) {
    case 'title':
      return issue.code === 'too_big' ? ISSUE_FORM_ERRORS.titleTooLong : ISSUE_FORM_ERRORS.titleRequired;
    case 'location':
      return ISSUE_FORM_ERRORS.locationRequired;
    case 'description':
      return ISSUE_FORM_ERRORS.descriptionTooLong;
    default:
      return ISSUE_FORM_ERRORS.titleRequired;
  }
}

/** Valeurs du formulaire → entrée du schéma partagé (description vide = absente, comme l'API l'attend). */
function toInput(values: IssueFormValues): Record<string, unknown> {
  const description = values.description.trim();
  return {
    title: values.title,
    location: values.location === '' ? undefined : values.location,
    urgent: values.urgent,
    ...(description === '' ? {} : { description }),
  };
}

/**
 * Schéma du formulaire pour `schemaResolver` : valide avec `createIssueSchema` de @syndic/shared
 * (aucune règle dupliquée) puis traduit chaque erreur en clé `issues.errors.*`.
 */
export const issueFormSchema = {
  safeParse(input: unknown):
    | { success: true; data: IssueFormValues }
    | { success: false; error: { issues: Issue[] } } {
    const values = input as IssueFormValues;
    const parsed = createIssueSchema.safeParse(toInput(values));
    if (parsed.success) return { success: true, data: values };
    return {
      success: false,
      error: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
          message: issueKey({ path: issue.path, code: issue.code, message: issue.message }),
        })),
      },
    };
  },
};

/** Saisie validée → champs du signalement (sans photo). `undefined` si elle est invalide. */
export function issueFieldsFrom(values: IssueFormValues): Fields | undefined {
  const parsed = createIssueSchema.safeParse(toInput(values));
  if (!parsed.success) return undefined;
  const { photoKey: _photoKey, ...fields } = parsed.data;
  return fields;
}

export { ISSUE_LOCATIONS, MAX_ISSUE_DESCRIPTION_LENGTH, MAX_ISSUE_MESSAGE_LENGTH, MAX_ISSUE_TITLE_LENGTH };

// ---------------------------------------------------------------------------------------------
// Dates (fuseau Africa/Casablanca)

/** Heure et minute d'un instant à Casablanca. */
export function clockOf(instant: string): { hour: number; minute: number } {
  const date = new Date(instant);
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const hour = get('hour');
    const minute = get('minute');
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  } catch {
    // Fuseau non pris en charge : repli ci-dessous (UTC+1).
  }
  const shifted = new Date(date.getTime() + 60 * 60 * 1000);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export type IssueAge =
  | { kind: 'now' }
  | { kind: 'minutes'; count: number }
  | { kind: 'hours'; count: number }
  | { kind: 'yesterday' }
  | { kind: 'date'; date: string };

/** « à l'instant », « il y a 2 h », « hier » ou la date : l'âge d'un signalement dans la liste. */
export function ageOf(instant: string, now: Date = new Date()): IssueAge {
  const elapsed = now.getTime() - new Date(instant).getTime();
  if (elapsed < MINUTE) return { kind: 'now' };
  if (elapsed < HOUR) return { kind: 'minutes', count: Math.floor(elapsed / MINUTE) };
  const day = casablancaDate(instant);
  const today = casablancaDate(now);
  if (day === today) return { kind: 'hours', count: Math.floor(elapsed / HOUR) };
  const yesterday = casablancaDate(new Date(now.getTime() - 24 * HOUR));
  return day === yesterday ? { kind: 'yesterday' } : { kind: 'date', date: day };
}

/** Jour d'un instant par rapport à aujourd'hui : « aujourd'hui », « hier » ou une autre date. */
export function dayRelation(instant: string, now: Date = new Date()): 'today' | 'yesterday' | 'other' {
  const day = casablancaDate(instant);
  if (day === casablancaDate(now)) return 'today';
  return day === casablancaDate(new Date(now.getTime() - 24 * HOUR)) ? 'yesterday' : 'other';
}
