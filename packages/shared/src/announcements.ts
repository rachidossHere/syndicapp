// Annonces de la résidence (plan 08, étape 3) : valeurs en anglais dans le code et la base.
// Les libellés affichés (Travaux, Assemblée…) passent par les traductions de l'appli : ce fichier ne
// contient que des codes et des clés de traduction.
import { z } from 'zod';

import type { NotificationType } from './notifications';
import type { Role } from './roles';

export const ANNOUNCEMENT_CATEGORIES = ['works', 'meeting', 'info', 'urgent'] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 80;
export const MAX_ANNOUNCEMENT_BODY_LENGTH = 1000;

export const DEFAULT_ANNOUNCEMENT_PAGE_SIZE = 20;
export const MAX_ANNOUNCEMENT_PAGE_SIZE = 50;

/** Clés de traduction des libellés de catégories. */
export const ANNOUNCEMENT_CATEGORY_LABEL_KEYS = {
  works: 'announcements.category.works',
  meeting: 'announcements.category.meeting',
  info: 'announcements.category.info',
  urgent: 'announcements.category.urgent',
} as const satisfies Record<AnnouncementCategory, `announcements.category.${AnnouncementCategory}`>;

/** Clés de traduction des refus de l'API des annonces (réponse `{ error: <clé> }`). */
export const ANNOUNCEMENT_ERRORS = {
  notFound: 'announcements.errors.notFound',
} as const;
export type AnnouncementErrorKey = (typeof ANNOUNCEMENT_ERRORS)[keyof typeof ANNOUNCEMENT_ERRORS];

/** Seule l'annonce « urgent » envoie une notification non désactivable. */
export function announcementNotificationType(category: AnnouncementCategory): NotificationType {
  return category === 'urgent' ? 'announcement_urgent' : 'announcement';
}

/** Publication (permission `announcements.write`). */
export const createAnnouncementSchema = z
  .object({
    category: z.enum(ANNOUNCEMENT_CATEGORIES),
    title: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_TITLE_LENGTH),
    body: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_BODY_LENGTH),
    pinned: z.boolean().default(false),
  })
  .strict();
export type CreateAnnouncementInput = z.input<typeof createAnnouncementSchema>;

/** Épingler (`true`) ou désépingler (`false`) : idempotent. */
export const pinAnnouncementSchema = z.object({ pinned: z.boolean() }).strict();
export type PinAnnouncementInput = z.infer<typeof pinAnnouncementSchema>;

/** Liste : pagination par curseur opaque (celui de `nextCursor` de la page précédente). */
export const announcementListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_ANNOUNCEMENT_PAGE_SIZE).default(DEFAULT_ANNOUNCEMENT_PAGE_SIZE),
    cursor: z.string().min(1).max(300).optional(),
  })
  .strict();
export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;

/**
 * Annonce telle que l'API la présente. L'auteur n'est désigné que par son rôle (« Le syndic »,
 * « L'adjoint ») : ni nom, ni identifiant.
 */
export type AnnouncementItem = {
  id: string;
  category: AnnouncementCategory;
  title: string;
  body: string;
  pinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  authorRole: Role | null;
  byYou: boolean;
};

export type AnnouncementListResponse = { items: AnnouncementItem[]; nextCursor: string | null };
export type LatestAnnouncementResponse = { announcement: AnnouncementItem | null };
/** Nombre de membres qui seront prévenus (membres actifs, sans l'auteur). */
export type AnnouncementAudienceResponse = { count: number };

/** Données d'une notification d'annonce : ce que l'appli lit au toucher pour ouvrir le détail. */
export type AnnouncementNotificationData = { type: NotificationType; residenceId: string; itemId: string };
