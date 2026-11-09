// Dépenses et factures (plan 06, étape 2). Toute route passe par requireAuth, requireMembership
// puis requirePermission. La résidence vient toujours du contexte (en-tête X-Residence-Id validé
// par requireMembership), jamais du corps de la requête. Aucune URL signée ni clé d'objet n'est
// écrite dans les logs. Les réponses ne contiennent que des rôles, jamais de nom ni d'e-mail.
import { randomUUID } from 'node:crypto';

import { db, schema } from '@syndic/db';
import {
  EXPENSE_ERRORS,
  INVOICE_CONTENT_TYPES,
  INVOICE_EXTENSIONS,
  MAX_INVOICE_SIZE_BYTES,
  cancelExpenseSchema,
  createExpenseSchema,
  expenseListQuerySchema,
  invoiceKeyPrefix,
  invoiceUploadRequestSchema,
  todayInCasablanca,
  type Role,
} from '@syndic/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { isUniqueViolation } from '../charge-errors';
import { expenseRefusal } from '../expense-errors';
import { requireAuth } from '../middleware/require-auth';
import {
  requireMembership,
  requirePermission,
  type MembershipEnv,
} from '../middleware/require-membership';
import { SIGNED_URL_TTL_SECONDS, getStorage } from '../storage/r2';
import { parseJson } from '../validate';

export const expenses = new Hono<MembershipEnv>();

type InvoiceType = (typeof INVOICE_CONTENT_TYPES)[number];
const isInvoiceType = (value: string): value is InvoiceType =>
  (INVOICE_CONTENT_TYPES as readonly string[]).includes(value);

const e = schema.expense;

/** Colonnes lues : les identifiants de personnes ne servent qu'à retrouver un rôle, jamais envoyés. */
const columns = {
  id: e.id,
  label: e.label,
  amount: e.amount,
  category: e.category,
  spentOn: e.spentOn,
  supplier: e.supplier,
  invoiceKey: e.invoiceKey,
  invoiceContentType: e.invoiceContentType,
  invoiceSize: e.invoiceSize,
  createdAt: e.createdAt,
  cancelledAt: e.cancelledAt,
  cancelReason: e.cancelReason,
  recordedBy: e.recordedBy,
  cancelledBy: e.cancelledBy,
};
type Row = {
  id: string;
  label: string;
  amount: number;
  category: string;
  spentOn: string;
  supplier: string | null;
  invoiceKey: string | null;
  invoiceContentType: string | null;
  invoiceSize: number | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  recordedBy: string;
  cancelledBy: string | null;
};

/** Rôle actuel (ou dernier) de chaque utilisateur dans la résidence : « le syndic », « le trésorier ». */
async function rolesOf(residenceId: string, userIds: string[]): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  for (const userId of new Set(userIds)) {
    const [row] = await db
      .select({ role: schema.membership.role })
      .from(schema.membership)
      .where(and(eq(schema.membership.residenceId, residenceId), eq(schema.membership.userId, userId)))
      .orderBy(desc(schema.membership.active), desc(schema.membership.createdAt))
      .limit(1);
    if (row) map.set(userId, row.role);
  }
  return map;
}

function present(row: Row, roles?: Map<string, Role>) {
  return {
    id: row.id,
    label: row.label,
    amount: row.amount,
    category: row.category,
    spentOn: row.spentOn,
    supplier: row.supplier,
    hasInvoice: row.invoiceKey !== null,
    invoiceContentType: row.invoiceContentType,
    invoiceSize: row.invoiceSize,
    createdAt: row.createdAt.toISOString(),
    cancelled: row.cancelledAt !== null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    ...(roles
      ? {
          recordedByRole: roles.get(row.recordedBy) ?? null,
          cancelledByRole: row.cancelledBy ? (roles.get(row.cancelledBy) ?? null) : null,
        }
      : {}),
  };
}

async function loadExpense(residenceId: string, id: string): Promise<Row | undefined> {
  const [row] = await db
    .select(columns)
    .from(e)
    .where(and(eq(e.id, id), eq(e.residenceId, residenceId)))
    .limit(1);
  return row;
}

async function detail(residenceId: string, row: Row) {
  const who = [row.recordedBy, ...(row.cancelledBy ? [row.cancelledBy] : [])];
  return present(row, await rolesOf(residenceId, who));
}

/**
 * URL signée d'envoi (PUT, 5 minutes) d'une facture. Type (JPEG, PNG, PDF) et taille (10 Mo
 * maximum) sont contrôlés ici puis inclus dans la signature : R2 refuse un autre fichier.
 */
expenses.post(
  '/upload-url',
  requireAuth,
  requireMembership,
  requirePermission('expenses.write'),
  async (c) => {
    const input = await parseJson(c, invoiceUploadRequestSchema);
    if (!isInvoiceType(input.contentType)) return expenseRefusal(EXPENSE_ERRORS.invalidFileType);
    if (input.size > MAX_INVOICE_SIZE_BYTES) return expenseRefusal(EXPENSE_ERRORS.fileTooLarge);

    const key = `${invoiceKeyPrefix(c.get('residenceId'))}${randomUUID()}.${INVOICE_EXTENSIONS[input.contentType]}`;
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
  },
);

/** Clé de facture de la résidence : residences/<id>/invoices/<uuid>.<jpg|png|pdf>, rien d'autre. */
function isOwnInvoiceKey(residenceId: string, key: string): boolean {
  const prefix = invoiceKeyPrefix(residenceId);
  if (!key.startsWith(prefix)) return false;
  return /^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(key.slice(prefix.length));
}

/**
 * Saisie d'une dépense. Idempotente : un `clientId` déjà connu dans la résidence renvoie la
 * dépense existante (200) sans en créer une autre. Une facture doit appartenir à la résidence,
 * exister dans R2 (HeadObject) avec un type et une taille autorisés ; ceux de R2 sont enregistrés.
 */
expenses.post('/', requireAuth, requireMembership, requirePermission('expenses.write'), async (c) => {
  const input = await parseJson(c, createExpenseSchema);
  const residenceId = c.get('residenceId');
  const userId = c.get('user').id;

  const existing = async () => {
    if (!input.clientId) return undefined;
    const [row] = await db
      .select(columns)
      .from(e)
      .where(and(eq(e.residenceId, residenceId), eq(e.clientId, input.clientId)))
      .limit(1);
    return row;
  };
  const replay = await existing();
  if (replay) return c.json(await detail(residenceId, replay), 200);

  const today = todayInCasablanca();
  const spentOn = input.spentOn ?? today;
  if (spentOn > today) return expenseRefusal(EXPENSE_ERRORS.dateInFuture);

  let invoice: { key: string; contentType: InvoiceType; size: number } | undefined;
  if (input.invoiceKey) {
    if (!isOwnInvoiceKey(residenceId, input.invoiceKey)) {
      return expenseRefusal(EXPENSE_ERRORS.invoiceNotFound);
    }
    const head = await getStorage().headObject(input.invoiceKey);
    if (!head || head.size <= 0) return expenseRefusal(EXPENSE_ERRORS.invoiceNotFound);
    const contentType = head.contentType ?? '';
    if (!isInvoiceType(contentType)) return expenseRefusal(EXPENSE_ERRORS.invalidFileType);
    if (head.size > MAX_INVOICE_SIZE_BYTES) return expenseRefusal(EXPENSE_ERRORS.fileTooLarge);
    invoice = { key: input.invoiceKey, contentType, size: head.size };
  }

  try {
    const [created] = await db
      .insert(e)
      .values({
        residenceId,
        label: input.label,
        amount: input.amount,
        category: input.category,
        spentOn,
        supplier: input.supplier ?? null,
        invoiceKey: invoice?.key ?? null,
        invoiceContentType: invoice?.contentType ?? null,
        invoiceSize: invoice?.size ?? null,
        recordedBy: userId,
        clientId: input.clientId ?? null,
      })
      .returning(columns);
    return c.json(await detail(residenceId, created!), 201);
  } catch (error) {
    // Deux envois simultanés du même client_id : le second relit la dépense du premier.
    if (isUniqueViolation(error)) {
      const raced = await existing();
      if (raced) return c.json(await detail(residenceId, raced), 200);
    }
    throw error;
  }
});

/** Liste paginée (accounts.read), du plus récent au plus ancien. */
expenses.get('/', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const parsed = expenseListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400);
  const { limit, offset } = parsed.data;
  const residenceId = c.get('residenceId');

  const [rows, [count]] = await Promise.all([
    db
      .select(columns)
      .from(e)
      .where(eq(e.residenceId, residenceId))
      .orderBy(desc(e.spentOn), desc(e.createdAt), desc(e.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(e)
      .where(eq(e.residenceId, residenceId)),
  ]);
  return c.json({ items: rows.map((row) => present(row)), total: count!.total, limit, offset });
});

/** Identifiant de dépense du chemin : un uuid invalide est traité comme introuvable (404). */
const idParam = (raw: string | undefined) => z.uuid().safeParse(raw);

/** Détail (accounts.read) : saisie par le rôle (syndic, trésorier), jamais le nom. */
expenses.get('/:id', requireAuth, requireMembership, requirePermission('accounts.read'), async (c) => {
  const id = idParam(c.req.param('id'));
  if (!id.success) return expenseRefusal(EXPENSE_ERRORS.notFound);
  const residenceId = c.get('residenceId');
  const row = await loadExpense(residenceId, id.data);
  if (!row) return expenseRefusal(EXPENSE_ERRORS.notFound);
  return c.json(await detail(residenceId, row));
});

/** Annulation (expenses.write) : motif obligatoire, tracée (qui, quand), 409 si déjà annulée. */
expenses.post(
  '/:id/cancel',
  requireAuth,
  requireMembership,
  requirePermission('expenses.write'),
  async (c) => {
    const id = idParam(c.req.param('id'));
    if (!id.success) return expenseRefusal(EXPENSE_ERRORS.notFound);
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = cancelExpenseSchema.safeParse(body);
    if (!parsed.success) return expenseRefusal(EXPENSE_ERRORS.cancelReasonRequired);
    const residenceId = c.get('residenceId');

    if (!(await loadExpense(residenceId, id.data))) return expenseRefusal(EXPENSE_ERRORS.notFound);
    // Mise à jour gardée par « non annulée » : deux annulations simultanées, une seule passe.
    const [cancelled] = await db
      .update(e)
      .set({ cancelledAt: new Date(), cancelledBy: c.get('user').id, cancelReason: parsed.data.reason })
      .where(and(eq(e.id, id.data), eq(e.residenceId, residenceId), isNull(e.cancelledAt)))
      .returning(columns);
    if (!cancelled) return expenseRefusal(EXPENSE_ERRORS.alreadyCancelled);
    return c.json(await detail(residenceId, cancelled));
  },
);

/** URL signée de lecture de la facture (accounts.read), 5 minutes ; 404 sans facture. */
expenses.get(
  '/:id/invoice-url',
  requireAuth,
  requireMembership,
  requirePermission('accounts.read'),
  async (c) => {
    const id = idParam(c.req.param('id'));
    if (!id.success) return expenseRefusal(EXPENSE_ERRORS.notFound);
    const row = await loadExpense(c.get('residenceId'), id.data);
    if (!row) return expenseRefusal(EXPENSE_ERRORS.notFound);
    if (!row.invoiceKey || !isInvoiceType(row.invoiceContentType ?? '')) {
      return expenseRefusal(EXPENSE_ERRORS.invoiceNotFound, 404);
    }
    const contentType = row.invoiceContentType as InvoiceType;
    const filename = `facture-${row.id}.${INVOICE_EXTENSIONS[contentType]}`;
    const url = await getStorage().getSignedReadUrl(row.invoiceKey, { filename, contentType });
    c.header('Cache-Control', 'no-store');
    return c.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, filename, contentType });
  },
);
