// Annonces (plan 08, étape 3). Toute route passe par requireAuth, requireMembership puis, pour une
// écriture, requirePermission('announcements.write'). La résidence vient toujours du contexte
// (en-tête X-Residence-Id validé par requireMembership), jamais du corps de la requête, et chaque
// requête filtre sur residence_id.
//
// Visibilité : tous les membres lisent toutes les annonces de leur résidence. L'auteur n'est jamais
// désigné par son nom ni son identifiant, seulement par son rôle (« Le syndic », « L'adjoint »).
//
// Notification : publier une annonce enregistre, DANS LA MÊME TRANSACTION, un envoi pour tous les
// membres actifs sauf l'auteur (module notify). Le texte de la notification est générique : jamais le
// titre ni le contenu de l'annonce.
import { db, schema } from '@syndic/db';
import {
  ANNOUNCEMENT_ERRORS,
  TIMEZONE,
  announcementListQuerySchema,
  announcementNotificationType,
  announcementSummaryQuerySchema,
  createAnnouncementSchema,
  pinAnnouncementSchema,
  type AnnouncementItem,
  type AnnouncementMonthSummary,
  type Role,
} from '@syndic/shared';
import { and, count, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireAuth } from '../middleware/require-auth';
import { requireMembership, requirePermission, type MembershipEnv } from '../middleware/require-membership';
import { notify } from '../notify';
import { parseJson } from '../validate';

export const announcements = new Hono<MembershipEnv>();

const a = schema.announcement;

const columns = {
  id: a.id,
  category: a.category,
  title: a.title,
  body: a.body,
  pinned: a.pinned,
  pinnedAt: a.pinnedAt,
  createdAt: a.createdAt,
  authorId: a.authorId,
};
type Row = {
  id: string;
  category: AnnouncementItem['category'];
  title: string;
  body: string;
  pinned: boolean;
  pinnedAt: Date | null;
  createdAt: Date;
  authorId: string;
};

const notFound = () => Response.json({ error: ANNOUNCEMENT_ERRORS.notFound }, { status: 404 });

/** Identifiant du chemin : un uuid invalide est traité comme introuvable (404). */
const idParam = (raw: string | undefined) => z.uuid().safeParse(raw);

/** Rôle actuel (ou dernier) de chaque auteur dans la résidence : seul ce rôle est envoyé. */
async function rolesOf(residenceId: string, userIds: string[]): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return map;
  const rows = await db
    .select({ userId: schema.membership.userId, role: schema.membership.role })
    .from(schema.membership)
    .where(and(eq(schema.membership.residenceId, residenceId), inArray(schema.membership.userId, unique)))
    .orderBy(desc(schema.membership.active), desc(schema.membership.createdAt));
  for (const row of rows) if (!map.has(row.userId)) map.set(row.userId, row.role);
  return map;
}

/** Annonce présentée au lecteur : ni nom, ni identifiant de l'auteur. */
async function present(residenceId: string, userId: string, rows: Row[]): Promise<AnnouncementItem[]> {
  const roles = await rolesOf(
    residenceId,
    rows.map((row) => row.authorId),
  );
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    authorRole: roles.get(row.authorId) ?? null,
    byYou: row.authorId === userId,
  }));
}

// --- Curseur ------------------------------------------------------------------------------------
// Ordre de la liste : épinglées d'abord (la plus récemment épinglée en tête), puis les autres de la
// plus récente à la plus ancienne ; l'identifiant départage les égalités. La date de tri est tronquée
// à la milliseconde (précision d'un Date JavaScript) : le curseur la retrouve exactement.
const sortAt = sql`date_trunc('milliseconds', coalesce(${a.pinnedAt}, ${a.createdAt}))`;

const cursorSchema = z.object({ p: z.boolean(), t: z.number().int(), id: z.uuid() }).strict();
type Cursor = z.infer<typeof cursorSchema>;

const encodeCursor = (row: Row): string =>
  Buffer.from(
    JSON.stringify({ p: row.pinned, t: (row.pinnedAt ?? row.createdAt).getTime(), id: row.id } satisfies Cursor),
  ).toString('base64url');

function decodeCursor(raw: string): Cursor {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    if (parsed.success) return parsed.data;
  } catch {
    // Curseur illisible : refusé ci-dessous.
  }
  throw new HTTPException(400);
}

/** Lignes strictement après le curseur dans l'ordre de la liste. */
function afterCursor(cursor: Cursor) {
  const at = sql`${new Date(cursor.t).toISOString()}::timestamptz`;
  const sameGroupAfter = and(
    eq(a.pinned, cursor.p),
    or(sql`${sortAt} < ${at}`, and(sql`${sortAt} = ${at}`, sql`${a.id} < ${cursor.id}`)),
  );
  // Après une annonce épinglée : le reste des épinglées, puis toutes les non épinglées.
  return cursor.p ? or(sameGroupAfter, eq(a.pinned, false)) : sameGroupAfter;
}

// --- Routes -------------------------------------------------------------------------------------

/**
 * Publication (announcements.write) : l'annonce et l'envoi aux membres actifs sauf l'auteur sont
 * écrits dans la même transaction (si l'une échoue, rien n'est enregistré ni envoyé). La catégorie
 * « urgent » envoie `announcement_urgent` (non désactivable), les autres `announcement`.
 */
announcements.post('/', requireAuth, requireMembership, requirePermission('announcements.write'), async (c) => {
  const input = await parseJson(c, createAnnouncementSchema);
  const residenceId = c.get('residenceId');
  const userId = c.get('user').id;

  const created = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .insert(a)
      .values({
        residenceId,
        authorId: userId,
        category: input.category,
        title: input.title,
        body: input.body,
        pinned: input.pinned,
        pinnedAt: input.pinned ? now : null,
        createdAt: now,
      })
      .returning(columns);
    const recipients = await tx
      .select({ userId: schema.membership.userId })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.residenceId, residenceId),
          eq(schema.membership.active, true),
          ne(schema.membership.userId, userId),
        ),
      );
    const userIds = [...new Set(recipients.map((recipient) => recipient.userId))];
    // Seul membre : personne à prévenir (l'audience d'un envoi ne peut pas être vide).
    if (userIds.length > 0) {
      await notify(residenceId, { kind: 'users', userIds }, announcementNotificationType(input.category), { itemId: row!.id }, tx);
    }
    return row!;
  });
  const [item] = await present(residenceId, userId, [created]);
  return c.json(item, 201);
});

/**
 * Mois de publication (AAAA-MM) dans le fuseau Africa/Casablanca : celui des sections de l'écran. Le fuseau
 * est écrit dans la requête (constante du code, jamais une saisie) : un paramètre lié ferait que Postgres
 * ne reconnaît plus la même expression dans `select` et dans `group by`.
 */
const publishedMonth = sql<string>`to_char(${a.createdAt} at time zone ${sql.raw(`'${TIMEZONE}'`)}, 'YYYY-MM')`;

/**
 * Résumé par mois (tous les rôles, comme la liste) : le nombre d'annonces non épinglées de chaque mois, du
 * plus récent au plus ancien. Les épinglées restent hors des sections. `?category=` ne compte que cette
 * catégorie (les mois sans annonce de cette catégorie disparaissent). Déclarée avant `/:id`.
 */
announcements.get('/summary', requireAuth, requireMembership, async (c) => {
  const parsed = announcementSummaryQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400);
  const rows = await db
    .select({ month: publishedMonth, count: count() })
    .from(a)
    .where(
      and(
        eq(a.residenceId, c.get('residenceId')),
        eq(a.pinned, false),
        parsed.data.category === undefined ? undefined : eq(a.category, parsed.data.category),
      ),
    )
    .groupBy(publishedMonth)
    .orderBy(desc(publishedMonth));
  c.header('Cache-Control', 'no-store');
  const months: AnnouncementMonthSummary[] = rows;
  return c.json({ months });
});

/**
 * Liste : épinglées d'abord, puis de la plus récente à la plus ancienne ; pagination par curseur.
 * Filtres facultatifs : `pinned=true|false`, `month=AAAA-MM` et `category=` (l'ordre et le curseur ne changent pas).
 */
announcements.get('/', requireAuth, requireMembership, async (c) => {
  const parsed = announcementListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400);
  const { limit, cursor, pinned, month, category } = parsed.data;
  const residenceId = c.get('residenceId');
  const scope = and(
    eq(a.residenceId, residenceId),
    pinned === undefined ? undefined : eq(a.pinned, pinned === 'true'),
    month === undefined ? undefined : sql`${publishedMonth} = ${month}`,
    category === undefined ? undefined : eq(a.category, category),
  );

  const rows = await db
    .select(columns)
    .from(a)
    .where(cursor === undefined ? scope : and(scope, afterCursor(decodeCursor(cursor))))
    .orderBy(desc(a.pinned), desc(sortAt), desc(a.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  c.header('Cache-Control', 'no-store');
  return c.json({
    items: await present(residenceId, c.get('user').id, page),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  });
});

/** La plus récente (carte « Dernière annonce » de l'accueil) : `null` s'il n'y en a aucune. */
announcements.get('/latest', requireAuth, requireMembership, async (c) => {
  const residenceId = c.get('residenceId');
  const [row] = await db
    .select(columns)
    .from(a)
    .where(eq(a.residenceId, residenceId))
    .orderBy(desc(a.createdAt), desc(a.id))
    .limit(1);
  c.header('Cache-Control', 'no-store');
  if (!row) return c.json({ announcement: null });
  const [item] = await present(residenceId, c.get('user').id, [row]);
  return c.json({ announcement: item });
});

/** Nombre de membres qui seront prévenus par une publication : membres actifs, sans l'auteur. */
announcements.get('/audience', requireAuth, requireMembership, requirePermission('announcements.write'), async (c) => {
  const [row] = await db
    .select({ total: count() })
    .from(schema.membership)
    .where(
      and(
        eq(schema.membership.residenceId, c.get('residenceId')),
        eq(schema.membership.active, true),
        ne(schema.membership.userId, c.get('user').id),
      ),
    );
  c.header('Cache-Control', 'no-store');
  return c.json({ count: row?.total ?? 0 });
});

/** Détail d'une annonce de la résidence (404 pour celle d'une autre résidence). */
announcements.get('/:id', requireAuth, requireMembership, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return notFound();
  const residenceId = c.get('residenceId');
  const [row] = await db
    .select(columns)
    .from(a)
    .where(and(eq(a.id, id.data), eq(a.residenceId, residenceId)))
    .limit(1);
  if (!row) return notFound();
  const [item] = await present(residenceId, c.get('user').id, [row]);
  c.header('Cache-Control', 'no-store');
  return c.json(item);
});

/**
 * Épingle (`pinned: true`) ou désépingle (`false`) : idempotent. Une annonce déjà dans l'état demandé
 * n'est pas modifiée (la date d'épinglage ne bouge pas) et la réponse est la même.
 */
announcements.post('/:id/pin', requireAuth, requireMembership, requirePermission('announcements.write'), async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return notFound();
  const input = await parseJson(c, pinAnnouncementSchema);
  const residenceId = c.get('residenceId');

  await db
    .update(a)
    .set({ pinned: input.pinned, pinnedAt: input.pinned ? new Date() : null })
    .where(and(eq(a.id, id.data), eq(a.residenceId, residenceId), ne(a.pinned, input.pinned)));
  const [row] = await db
    .select(columns)
    .from(a)
    .where(and(eq(a.id, id.data), eq(a.residenceId, residenceId)))
    .limit(1);
  if (!row) return notFound();
  const [item] = await present(residenceId, c.get('user').id, [row]);
  return c.json(item);
});
