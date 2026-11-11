// Signalements (plan 07, étape 1). Toute route passe par requireAuth, requireMembership puis, quand
// une permission est exigée, requirePermission. La résidence vient toujours du contexte (en-tête
// X-Residence-Id validé par requireMembership), jamais du corps de la requête. Aucune URL signée
// ni clé d'objet n'est écrite dans les logs.
//
// Visibilité : tous les membres voient tous les signalements de la résidence. Le nom et
// l'appartement de l'auteur ne sont lus puis envoyés qu'aux rôles avec `issues.manage` ; les autres
// reçoivent seulement `byYou`. Pour l'historique, un acteur du personnel (rôle avec `issues.manage`,
// autre que l'auteur du signalement) est désigné par son rôle (« le syndic », « le gardien »).
import { randomUUID } from 'node:crypto';

import { db, schema } from '@syndic/db';
import {
  ISSUE_ERRORS,
  ISSUE_PHOTO_CONTENT_TYPES,
  ISSUE_PHOTO_EXTENSIONS,
  MAX_ISSUE_PHOTO_SIZE_BYTES,
  can,
  changeIssueStatusSchema,
  createIssueSchema,
  isWithinReopenWindow,
  issueCommentSchema,
  issueKeyPrefix,
  issueListQuerySchema,
  issueUploadRequestSchema,
  reopenIssueSchema,
  type IssueStatus,
  type Role,
} from '@syndic/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { IssueRefusal, issueRefusal, withIssueRefusals } from '../issue-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { SIGNED_URL_TTL_SECONDS, getStorage } from '../storage/r2';
import { parseJson } from '../validate';

export const issues = new Hono<MembershipEnv>();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PhotoType = (typeof ISSUE_PHOTO_CONTENT_TYPES)[number];
const isPhotoType = (value: string): value is PhotoType =>
  (ISSUE_PHOTO_CONTENT_TYPES as readonly string[]).includes(value);

const i = schema.issue;
const ev = schema.issueEvent;

/** Colonnes lues : l'auteur n'est jamais envoyé tel quel (voir `Directory`). */
const columns = {
  id: i.id,
  title: i.title,
  description: i.description,
  location: i.location,
  urgent: i.urgent,
  status: i.status,
  photoKey: i.photoKey,
  photoContentType: i.photoContentType,
  photoSize: i.photoSize,
  authorId: i.authorId,
  authorLotId: i.authorLotId,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
  resolvedAt: i.resolvedAt,
};
type Row = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  urgent: boolean;
  status: IssueStatus;
  photoKey: string | null;
  photoContentType: string | null;
  photoSize: number | null;
  authorId: string;
  authorLotId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

const eventColumns = {
  id: ev.id,
  type: ev.type,
  fromStatus: ev.fromStatus,
  toStatus: ev.toStatus,
  message: ev.message,
  authorId: ev.authorId,
  createdAt: ev.createdAt,
};

/** Rôles (et, pour le personnel seulement, noms et appartements) des personnes citées. */
type Directory = {
  roles: Map<string, Role>;
  names: Map<string, string>;
  lots: Map<string, string>;
};

/** Rôle actuel (ou dernier) de chaque utilisateur dans la résidence. */
async function rolesOf(residenceId: string, userIds: string[]): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ userId: schema.membership.userId, role: schema.membership.role })
    .from(schema.membership)
    .where(
      and(eq(schema.membership.residenceId, residenceId), inArray(schema.membership.userId, userIds)),
    )
    .orderBy(desc(schema.membership.active), desc(schema.membership.createdAt));
  for (const row of rows) if (!map.has(row.userId)) map.set(row.userId, row.role);
  return map;
}

/**
 * Charge ce qu'il faut pour présenter les auteurs. Les noms et les appartements ne sont lus que
 * si le lecteur a `issues.manage` : sinon ils ne quittent jamais la base.
 */
async function directoryOf(
  residenceId: string,
  userIds: string[],
  lotIds: string[],
  manage: boolean,
): Promise<Directory> {
  const unique = [...new Set(userIds)];
  const directory: Directory = {
    roles: await rolesOf(residenceId, unique),
    names: new Map(),
    lots: new Map(),
  };
  if (!manage) return directory;
  if (unique.length > 0) {
    const users = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(inArray(schema.user.id, unique));
    for (const row of users) directory.names.set(row.id, row.name);
  }
  const uniqueLots = [...new Set(lotIds)];
  if (uniqueLots.length > 0) {
    const lots = await db
      .select({ id: schema.lot.id, reference: schema.lot.reference })
      .from(schema.lot)
      .where(and(eq(schema.lot.residenceId, residenceId), inArray(schema.lot.id, uniqueLots)));
    for (const row of lots) directory.lots.set(row.id, row.reference);
  }
  return directory;
}

type Viewer = { userId: string; manage: boolean };

function presentIssue(row: Row, viewer: Viewer, directory: Directory) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    urgent: row.urgent,
    status: row.status,
    hasPhoto: row.photoKey !== null,
    photoContentType: row.photoContentType,
    photoSize: row.photoSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    byYou: row.authorId === viewer.userId,
    ...(viewer.manage
      ? {
          author: {
            name: directory.names.get(row.authorId) ?? null,
            lot: row.authorLotId ? (directory.lots.get(row.authorLotId) ?? null) : null,
          },
        }
      : {}),
  };
}

type EventRow = {
  id: string;
  type: string;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus | null;
  message: string | null;
  authorId: string;
  createdAt: Date;
};

function presentEvent(row: EventRow, issueAuthorId: string, viewer: Viewer, directory: Directory) {
  const role = directory.roles.get(row.authorId) ?? null;
  // Habitant : le rôle n'est donné que pour le personnel, jamais pour l'auteur du signalement
  // (le désigner par son rôle révélerait qui c'est).
  const staffRole = role && can(role, 'issues.manage') && row.authorId !== issueAuthorId ? role : null;
  return {
    id: row.id,
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    byYou: row.authorId === viewer.userId,
    authorRole: viewer.manage ? role : staffRole,
    ...(viewer.manage ? { authorName: directory.names.get(row.authorId) ?? null } : {}),
  };
}

const viewerOf = (c: { get(key: 'user'): { id: string }; get(key: 'role'): Role }): Viewer => ({
  userId: c.get('user').id,
  manage: can(c.get('role'), 'issues.manage'),
});

async function loadIssue(residenceId: string, id: string): Promise<Row | undefined> {
  const [row] = await db
    .select(columns)
    .from(i)
    .where(and(eq(i.id, id), eq(i.residenceId, residenceId)))
    .limit(1);
  return row;
}

/** Détail avec l'historique, présenté pour le lecteur. */
async function detail(residenceId: string, row: Row, viewer: Viewer) {
  const events = await db
    .select(eventColumns)
    .from(ev)
    .where(and(eq(ev.issueId, row.id), eq(ev.residenceId, residenceId)))
    .orderBy(asc(ev.createdAt), asc(ev.id));
  const directory = await directoryOf(
    residenceId,
    [row.authorId, ...events.map((event) => event.authorId)],
    row.authorLotId ? [row.authorLotId] : [],
    viewer.manage,
  );
  return {
    ...presentIssue(row, viewer, directory),
    canReopen:
      viewer.userId === row.authorId &&
      row.status === 'resolved' &&
      row.resolvedAt !== null &&
      isWithinReopenWindow(row.resolvedAt),
    events: events.map((event) => presentEvent(event, row.authorId, viewer, directory)),
  };
}

/** Identifiant de signalement du chemin : un uuid invalide est traité comme introuvable (404). */
const idParam = (raw: string | undefined) => z.uuid().safeParse(raw);

/** Verrouille le signalement (`for update`) jusqu'à la fin de la transaction. */
async function lockIssue(tx: Tx, residenceId: string, id: string): Promise<Row | undefined> {
  const [row] = await tx
    .select(columns)
    .from(i)
    .where(and(eq(i.id, id), eq(i.residenceId, residenceId)))
    .for('update')
    .limit(1);
  return row;
}

/**
 * URL signée d'envoi (PUT, 5 minutes) d'une photo. Type (JPEG, PNG) et taille (10 Mo maximum)
 * sont contrôlés ici puis inclus dans la signature : R2 refuse un autre fichier.
 */
issues.post('/upload-url', requireAuth, requireMembership, requirePermission('issues.write'), async (c) => {
  const input = await parseJson(c, issueUploadRequestSchema);
  if (!isPhotoType(input.contentType)) return issueRefusal(ISSUE_ERRORS.invalidFileType);
  if (input.size > MAX_ISSUE_PHOTO_SIZE_BYTES) return issueRefusal(ISSUE_ERRORS.fileTooLarge);

  const key = `${issueKeyPrefix(c.get('residenceId'))}${randomUUID()}.${ISSUE_PHOTO_EXTENSIONS[input.contentType]}`;
  const uploadUrl = await getStorage().getSignedUploadUrl(key, {
    contentType: input.contentType,
    size: input.size,
  });
  c.header('Cache-Control', 'no-store');
  return c.json({
    uploadUrl,
    key,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
});

/** Clé de photo de la résidence : residences/<id>/issues/<uuid>.<jpg|png>, rien d'autre. */
function isOwnPhotoKey(residenceId: string, key: string): boolean {
  const prefix = issueKeyPrefix(residenceId);
  if (!key.startsWith(prefix)) return false;
  return /^[0-9a-f-]{36}\.(jpg|png)$/.test(key.slice(prefix.length));
}

/**
 * Création (issues.write). Une photo doit appartenir à la résidence, exister dans R2 (HeadObject)
 * avec un type et une taille autorisés ; ceux de R2 sont enregistrés. Le signalement et son
 * événement « created » sont écrits dans la même transaction.
 */
issues.post('/', requireAuth, requireMembership, requirePermission('issues.write'), async (c) => {
  const input = await parseJson(c, createIssueSchema);
  const residenceId = c.get('residenceId');
  const viewer = viewerOf(c);

  let photo: { key: string; contentType: PhotoType; size: number } | undefined;
  if (input.photoKey) {
    if (!isOwnPhotoKey(residenceId, input.photoKey)) return issueRefusal(ISSUE_ERRORS.photoNotFound);
    const head = await getStorage().headObject(input.photoKey);
    if (!head || head.size <= 0) return issueRefusal(ISSUE_ERRORS.photoNotFound);
    const contentType = head.contentType ?? '';
    if (!isPhotoType(contentType)) return issueRefusal(ISSUE_ERRORS.invalidFileType);
    if (head.size > MAX_ISSUE_PHOTO_SIZE_BYTES) return issueRefusal(ISSUE_ERRORS.fileTooLarge);
    photo = { key: input.photoKey, contentType, size: head.size };
  }

  // Appartement de l'auteur (facultatif), lu dans son membership de la résidence.
  const [membership] = await db
    .select({ lotId: schema.membership.lotId })
    .from(schema.membership)
    .where(
      and(eq(schema.membership.id, c.get('membershipId')), eq(schema.membership.residenceId, residenceId)),
    )
    .limit(1);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(i)
      .values({
        residenceId,
        title: input.title,
        description: input.description ?? null,
        location: input.location,
        urgent: input.urgent,
        status: 'open',
        photoKey: photo?.key ?? null,
        photoContentType: photo?.contentType ?? null,
        photoSize: photo?.size ?? null,
        authorId: viewer.userId,
        authorLotId: membership?.lotId ?? null,
      })
      .returning(columns);
    await tx.insert(ev).values({
      residenceId,
      issueId: row!.id,
      type: 'created',
      toStatus: 'open',
      authorId: viewer.userId,
    });
    return row!;
  });
  return c.json(await detail(residenceId, created, viewer), 201);
});

/** Liste paginée de tous les signalements de la résidence : urgents non résolus d'abord, puis les plus récents. */
issues.get('/', requireAuth, requireMembership, async (c) => {
  const parsed = issueListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400);
  const { status, limit, offset } = parsed.data;
  const residenceId = c.get('residenceId');
  const viewer = viewerOf(c);
  const where = status
    ? and(eq(i.residenceId, residenceId), eq(i.status, status))
    : eq(i.residenceId, residenceId);

  const [rows, [count], grouped] = await Promise.all([
    db
      .select(columns)
      .from(i)
      .where(where)
      .orderBy(desc(sql`(${i.urgent} and ${i.status} <> 'resolved')`), desc(i.createdAt), desc(i.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(i)
      .where(where),
    // Compteurs de la résidence (indépendants du filtre) pour les onglets et le bandeau des urgents.
    db
      .select({
        status: i.status,
        total: sql<number>`count(*)`.mapWith(Number),
        urgent: sql<number>`count(*) filter (where ${i.urgent})`.mapWith(Number),
      })
      .from(i)
      .where(eq(i.residenceId, residenceId))
      .groupBy(i.status),
  ]);

  const directory = await directoryOf(
    residenceId,
    rows.map((row) => row.authorId),
    rows.flatMap((row) => (row.authorLotId ? [row.authorLotId] : [])),
    viewer.manage,
  );
  const counts = { open: 0, in_progress: 0, resolved: 0, urgentUnresolved: 0 };
  for (const group of grouped) {
    counts[group.status] = group.total;
    if (group.status !== 'resolved') counts.urgentUnresolved += group.urgent;
  }
  return c.json({
    items: rows.map((row) => presentIssue(row, viewer, directory)),
    total: count!.total,
    limit,
    offset,
    counts,
  });
});

/** Détail avec l'historique des événements. */
issues.get('/:id', requireAuth, requireMembership, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return issueRefusal(ISSUE_ERRORS.notFound);
  const residenceId = c.get('residenceId');
  const row = await loadIssue(residenceId, id.data);
  if (!row) return issueRefusal(ISSUE_ERRORS.notFound);
  return c.json(await detail(residenceId, row, viewerOf(c)));
});

/**
 * Changement de statut (issues.manage), message aux habitants facultatif. Une transaction avec
 * verrou : statut, `resolved_at` (rempli à « resolved », vidé sinon) et événement ensemble.
 * 409 si le statut demandé est déjà le statut actuel.
 */
issues.post('/:id/status', requireAuth, requireMembership, requirePermission('issues.manage'), async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return issueRefusal(ISSUE_ERRORS.notFound);
  const input = await parseJson(c, changeIssueStatusSchema);
  const residenceId = c.get('residenceId');
  const viewer = viewerOf(c);

  return withIssueRefusals(async () => {
    const updated = await db.transaction(async (tx) => {
      const current = await lockIssue(tx, residenceId, id.data);
      if (!current) throw new IssueRefusal(ISSUE_ERRORS.notFound);
      if (current.status === input.status) throw new IssueRefusal(ISSUE_ERRORS.statusUnchanged);
      const now = new Date();
      const [row] = await tx
        .update(i)
        .set({ status: input.status, resolvedAt: input.status === 'resolved' ? now : null, updatedAt: now })
        .where(and(eq(i.id, current.id), eq(i.residenceId, residenceId)))
        .returning(columns);
      await tx.insert(ev).values({
        residenceId,
        issueId: current.id,
        type: 'status_changed',
        fromStatus: current.status,
        toStatus: input.status,
        message: input.message ?? null,
        authorId: viewer.userId,
        createdAt: now,
      });
      return row!;
    });
    return c.json(await detail(residenceId, updated, viewer));
  });
});

/** Commentaire : l'auteur du signalement ou un rôle avec issues.manage ; 403 pour un autre habitant. */
issues.post('/:id/comments', requireAuth, requireMembership, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return issueRefusal(ISSUE_ERRORS.notFound);
  const residenceId = c.get('residenceId');
  const viewer = viewerOf(c);
  const current = await loadIssue(residenceId, id.data);
  if (!current) return issueRefusal(ISSUE_ERRORS.notFound);
  if (current.authorId !== viewer.userId && !viewer.manage) {
    return issueRefusal(ISSUE_ERRORS.commentForbidden);
  }
  const input = await parseJson(c, issueCommentSchema);

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(ev).values({
      residenceId,
      issueId: current.id,
      type: 'comment',
      message: input.message,
      authorId: viewer.userId,
      createdAt: now,
    });
    const [row] = await tx
      .update(i)
      .set({ updatedAt: now })
      .where(and(eq(i.id, current.id), eq(i.residenceId, residenceId)))
      .returning(columns);
    return row!;
  });
  return c.json(await detail(residenceId, updated, viewer), 201);
});

/**
 * Réouverture : l'auteur seulement (403 sinon), d'un signalement résolu (409 sinon), dans les
 * 7 jours après `resolved_at` (409 passé ce délai). Statut, `resolved_at` et événement ensemble.
 */
issues.post('/:id/reopen', requireAuth, requireMembership, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return issueRefusal(ISSUE_ERRORS.notFound);
  const residenceId = c.get('residenceId');
  const viewer = viewerOf(c);
  const probe = await loadIssue(residenceId, id.data);
  if (!probe) return issueRefusal(ISSUE_ERRORS.notFound);
  if (probe.authorId !== viewer.userId) return issueRefusal(ISSUE_ERRORS.reopenForbidden);
  const input = await parseJson(c, reopenIssueSchema);

  return withIssueRefusals(async () => {
    const updated = await db.transaction(async (tx) => {
      const current = await lockIssue(tx, residenceId, id.data);
      if (!current) throw new IssueRefusal(ISSUE_ERRORS.notFound);
      if (current.status !== 'resolved' || !current.resolvedAt) {
        throw new IssueRefusal(ISSUE_ERRORS.notResolved);
      }
      if (!isWithinReopenWindow(current.resolvedAt)) throw new IssueRefusal(ISSUE_ERRORS.reopenExpired);
      const now = new Date();
      const [row] = await tx
        .update(i)
        .set({ status: 'open', resolvedAt: null, updatedAt: now })
        .where(and(eq(i.id, current.id), eq(i.residenceId, residenceId)))
        .returning(columns);
      await tx.insert(ev).values({
        residenceId,
        issueId: current.id,
        type: 'reopened',
        fromStatus: 'resolved',
        toStatus: 'open',
        message: input.message ?? null,
        authorId: viewer.userId,
        createdAt: now,
      });
      return row!;
    });
    return c.json(await detail(residenceId, updated, viewer));
  });
});

/** URL signée de lecture de la photo (tous les membres), 5 minutes ; 404 sans photo. */
issues.get('/:id/photo-url', requireAuth, requireMembership, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return issueRefusal(ISSUE_ERRORS.notFound);
  const row = await loadIssue(c.get('residenceId'), id.data);
  if (!row) return issueRefusal(ISSUE_ERRORS.notFound);
  if (!row.photoKey || !isPhotoType(row.photoContentType ?? '')) {
    return issueRefusal(ISSUE_ERRORS.photoNotFound, 404);
  }
  const contentType = row.photoContentType as PhotoType;
  const filename = `signalement-${row.id}.${ISSUE_PHOTO_EXTENSIONS[contentType]}`;
  const url = await getStorage().getSignedReadUrl(row.photoKey, { filename, contentType });
  c.header('Cache-Control', 'no-store');
  return c.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, filename, contentType });
});
