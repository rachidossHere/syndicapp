// Annonces côté appli (plan 08, étape 3) : accès par rôle, catégories, auteur par rôle, dates,
// pagination, validation du formulaire. Fonctions pures, sans React : testées avec vitest.
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_LABEL_KEYS,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  can,
  createAnnouncementSchema,
  type AnnouncementCategory,
  type AnnouncementItem,
  type CreateAnnouncementInput,
  type Role,
} from '@syndic/shared';

import type { TranslationKey } from '@/i18n/translate';

import { casablancaDate } from './charges-format';
import { clockOf, dayRelation } from './issues';

export type { AnnouncementCategory, AnnouncementItem };
export { ANNOUNCEMENT_CATEGORIES, MAX_ANNOUNCEMENT_BODY_LENGTH, MAX_ANNOUNCEMENT_TITLE_LENGTH };

// ---------------------------------------------------------------------------------------------
// Accès (l'API refuse de toute façon ce que le rôle ne permet pas)

/** Tous les rôles lisent les annonces ; seule la publication et l'épinglage demandent une permission. */
export const canPublishAnnouncement = (role: Role | undefined): boolean =>
  role !== undefined && can(role, 'announcements.write');

/** Résidence des annonces : la résidence active (tous les rôles), `undefined` sans résidence. */
export const announcementsResidenceId = (active: { id: string } | null): string | undefined => active?.id;

// ---------------------------------------------------------------------------------------------
// Présentation

/** Ton du badge de chaque catégorie (le libellé accompagne toujours la couleur). */
export const CATEGORY_TONES = {
  works: 'warning',
  meeting: 'success',
  info: 'info',
  urgent: 'danger',
} as const satisfies Record<AnnouncementCategory, 'success' | 'warning' | 'danger' | 'info'>;

export const categoryLabelKey = (category: AnnouncementCategory): TranslationKey =>
  ANNOUNCEMENT_CATEGORY_LABEL_KEYS[category] as TranslationKey;

/** « Le syndic », « L'adjoint » : l'auteur n'est jamais désigné par son nom. */
export function authorLabelKey(role: Role | null): TranslationKey | undefined {
  if (role === 'manager') return 'announcements.author.manager';
  if (role === 'deputy') return 'announcements.author.deputy';
  return undefined;
}

export type AnnouncementWhen =
  | { kind: 'today'; hour: number; minute: number }
  | { kind: 'yesterday' }
  | { kind: 'date'; date: string };

/** « aujourd'hui à 8 h 30 », « hier » ou la date (fuseau Africa/Casablanca). */
export function announcementWhen(instant: string, now: Date = new Date()): AnnouncementWhen {
  const relation = dayRelation(instant, now);
  if (relation === 'today') return { kind: 'today', ...clockOf(instant) };
  if (relation === 'yesterday') return { kind: 'yesterday' };
  return { kind: 'date', date: casablancaDate(instant) };
}

/**
 * Annonce à montrer dans la carte « Dernière annonce » de l'accueil, ou `null` : la carte est cachée
 * pendant le chargement, en cas d'erreur et quand la résidence n'a aucune annonce.
 */
export const latestAnnouncementToShow = (data: AnnouncementItem | null | undefined): AnnouncementItem | null =>
  data ?? null;

/** Texte sous le formulaire : « Les N membres de la résidence seront prévenus » (singulier, pluriel, aucun). */
export function audienceNoteKey(count: number | undefined): TranslationKey {
  if (count === undefined) return 'announcements.audience.unknown';
  if (count === 0) return 'announcements.audience.none';
  return count === 1 ? 'announcements.audience.one' : 'announcements.audience.other';
}

// ---------------------------------------------------------------------------------------------
// Pagination

/** Pages mises bout à bout : une annonce revue d'une page à l'autre n'est affichée qu'une fois. */
export function mergeAnnouncementPages(pages: readonly { items: readonly AnnouncementItem[] }[]): AnnouncementItem[] {
  const byId = new Map<string, AnnouncementItem>();
  for (const page of pages) for (const item of page.items) byId.set(item.id, item);
  return [...byId.values()];
}

// ---------------------------------------------------------------------------------------------
// Formulaire « Nouvelle annonce »

export type AnnouncementFormValues = {
  category: AnnouncementCategory;
  title: string;
  body: string;
  pinned: boolean;
};

/** Valeurs de départ : « Travaux » est présélectionné (écran 4 de docs/annonces.png). */
export const DEFAULT_ANNOUNCEMENT_FORM: AnnouncementFormValues = {
  category: 'works',
  title: '',
  body: '',
  pinned: false,
};

export const ANNOUNCEMENT_FORM_ERRORS = {
  titleRequired: 'announcements.errors.titleRequired',
  titleTooLong: 'announcements.errors.titleTooLong',
  bodyRequired: 'announcements.errors.bodyRequired',
  bodyTooLong: 'announcements.errors.bodyTooLong',
} as const;

type Issue = { path: readonly PropertyKey[]; message: string; code: string };

function issueKey(issue: Issue): string {
  if (issue.path[0] === 'body') {
    return issue.code === 'too_big' ? ANNOUNCEMENT_FORM_ERRORS.bodyTooLong : ANNOUNCEMENT_FORM_ERRORS.bodyRequired;
  }
  return issue.code === 'too_big' ? ANNOUNCEMENT_FORM_ERRORS.titleTooLong : ANNOUNCEMENT_FORM_ERRORS.titleRequired;
}

/**
 * Schéma du formulaire pour `schemaResolver` : valide avec `createAnnouncementSchema` de
 * @syndic/shared (aucune règle dupliquée) puis traduit chaque erreur en clé `announcements.errors.*`.
 */
export const announcementFormSchema = {
  safeParse(input: unknown):
    | { success: true; data: AnnouncementFormValues }
    | { success: false; error: { issues: Issue[] } } {
    const parsed = createAnnouncementSchema.safeParse(input);
    if (parsed.success) return { success: true, data: input as AnnouncementFormValues };
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

/** Le bouton « Publier » n'est actif que si le formulaire est valide. */
export const canSubmitAnnouncement = (values: AnnouncementFormValues): boolean =>
  createAnnouncementSchema.safeParse(values).success;

/** Saisie validée → corps de POST /api/announcements. `undefined` si elle est invalide. */
export function announcementInputFrom(values: AnnouncementFormValues): CreateAnnouncementInput | undefined {
  const parsed = createAnnouncementSchema.safeParse(values);
  return parsed.success ? parsed.data : undefined;
}
