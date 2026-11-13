// Signalements (plan 07) : valeurs en anglais dans le code et la base.
// Les libellés affichés (Ouvert, Ascenseur…) passent par les traductions de l'appli : ce fichier
// ne contient que les clés de traduction, ajoutées à fr.ts et ar.ts avec les écrans (étapes 2 et 3).
import { z } from 'zod';

export const MAX_ISSUE_PAGE_SIZE = 100;
export const DEFAULT_ISSUE_PAGE_SIZE = 20;

/** Statuts d'un signalement. Changés par les rôles avec `issues.manage` (syndic, adjoint, gardien). */
export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Emplacements d'un signalement : liste fixe. */
export const ISSUE_LOCATIONS = ['elevator', 'stairs', 'parking', 'hall', 'roof', 'other'] as const;
export type IssueLocation = (typeof ISSUE_LOCATIONS)[number];

/** Types d'événements de l'historique d'un signalement. */
export const ISSUE_EVENT_TYPES = ['created', 'status_changed', 'comment', 'reopened'] as const;
export type IssueEventType = (typeof ISSUE_EVENT_TYPES)[number];

/** Clés de traduction des libellés (Ouvert, En cours, Résolu ; Ascenseur, Escalier…). */
export const ISSUE_STATUS_LABEL_KEYS: Record<IssueStatus, string> = {
  open: 'issues.status.open',
  in_progress: 'issues.status.in_progress',
  resolved: 'issues.status.resolved',
};
export const ISSUE_LOCATION_LABEL_KEYS: Record<IssueLocation, string> = {
  elevator: 'issues.location.elevator',
  stairs: 'issues.location.stairs',
  parking: 'issues.location.parking',
  hall: 'issues.location.hall',
  roof: 'issues.location.roof',
  other: 'issues.location.other',
};

/** Clés de traduction des refus de l'API des signalements (réponse `{ error: <clé> }`). */
export const ISSUE_ERRORS = {
  notFound: 'issues.errors.notFound',
  invalidFileType: 'issues.errors.invalidFileType',
  fileTooLarge: 'issues.errors.fileTooLarge',
  photoNotFound: 'issues.errors.photoNotFound',
  statusUnchanged: 'issues.errors.statusUnchanged',
  commentForbidden: 'issues.errors.commentForbidden',
  reopenForbidden: 'issues.errors.reopenForbidden',
  notResolved: 'issues.errors.notResolved',
  reopenExpired: 'issues.errors.reopenExpired',
} as const;
export type IssueErrorKey = (typeof ISSUE_ERRORS)[keyof typeof ISSUE_ERRORS];

/** Un signalement résolu peut être rouvert par son auteur pendant 7 jours. */
export const REOPEN_WINDOW_DAYS = 7;
export const REOPEN_WINDOW_MS = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Indique si un signalement résolu à `resolvedAt` peut encore être rouvert à l'instant `now`. */
export function isWithinReopenWindow(resolvedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - resolvedAt.getTime() <= REOPEN_WINDOW_MS;
}

/** Photo : images seulement (compressées par l'appli en JPEG), 10 Mo au plus. */
export const ISSUE_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_ISSUE_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

/** Extension de l'objet R2 pour chaque type de photo. */
export const ISSUE_PHOTO_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const satisfies Record<(typeof ISSUE_PHOTO_CONTENT_TYPES)[number], string>;

/** Préfixe des clés de photos d'une résidence : residences/<id>/issues/. */
export const issueKeyPrefix = (residenceId: string): string => `residences/${residenceId}/issues/`;

/** Demande d'URL d'envoi : type et taille sont inclus dans la signature. */
export const issueUploadRequestSchema = z
  .object({
    contentType: z.string().trim().min(1).max(100),
    size: z.number().int().positive(),
  })
  .strict();
export type IssueUploadRequest = z.infer<typeof issueUploadRequestSchema>;

export const MAX_ISSUE_TITLE_LENGTH = 120;
export const MAX_ISSUE_DESCRIPTION_LENGTH = 2000;
export const MAX_ISSUE_MESSAGE_LENGTH = 1000;

/** Création d'un signalement (permission `issues.write`). */
export const createIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_ISSUE_TITLE_LENGTH),
    description: z.string().trim().min(1).max(MAX_ISSUE_DESCRIPTION_LENGTH).optional(),
    location: z.enum(ISSUE_LOCATIONS),
    urgent: z.boolean().default(false),
    // Clé de la photo déjà envoyée vers R2 ; type et taille sont lus dans R2 par l'API.
    photoKey: z.string().trim().min(1).max(300).optional(),
  })
  .strict();
export type CreateIssueInput = z.input<typeof createIssueSchema>;

/** Changement de statut (permission `issues.manage`), message aux habitants facultatif. */
export const changeIssueStatusSchema = z
  .object({
    status: z.enum(ISSUE_STATUSES),
    message: z.string().trim().min(1).max(MAX_ISSUE_MESSAGE_LENGTH).optional(),
  })
  .strict();
export type ChangeIssueStatusInput = z.infer<typeof changeIssueStatusSchema>;

/** Commentaire : l'auteur du signalement ou un rôle avec `issues.manage`. */
export const issueCommentSchema = z
  .object({ message: z.string().trim().min(1).max(MAX_ISSUE_MESSAGE_LENGTH) })
  .strict();
export type IssueCommentInput = z.infer<typeof issueCommentSchema>;

/** Réouverture par l'auteur : message facultatif. */
export const reopenIssueSchema = z
  .object({ message: z.string().trim().min(1).max(MAX_ISSUE_MESSAGE_LENGTH).optional() })
  .strict();
export type ReopenIssueInput = z.infer<typeof reopenIssueSchema>;

/** Liste des signalements : filtre par statut et pagination. */
export const issueListQuerySchema = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_ISSUE_PAGE_SIZE).default(DEFAULT_ISSUE_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type IssueListQuery = z.infer<typeof issueListQuerySchema>;
