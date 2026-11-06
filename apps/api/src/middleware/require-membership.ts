import { db, schema } from '@syndic/db';
import { can, type Permission, type Role } from '@syndic/shared';
import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { type AuthEnv } from './require-auth';

export const RESIDENCE_HEADER = 'X-Residence-Id';

/** Variables posées par `requireMembership` (en plus de celles de `requireAuth`). */
export type MembershipEnv = {
  Variables: AuthEnv['Variables'] & {
    residenceId: string;
    role: Role;
    membershipId: string;
  };
};

const residenceIdSchema = z.uuid();

/**
 * Exige un membership actif dans la résidence de l'en-tête `X-Residence-Id` (après `requireAuth`).
 * - en-tête absent ou qui n'est pas un uuid : 400 ;
 * - résidence inexistante OU utilisateur non membre : la même réponse 403 `{ error: "forbidden" }`,
 *   pour ne jamais révéler qu'une résidence existe (jamais de 404 à sa place).
 */
export const requireMembership = createMiddleware<MembershipEnv>(async (c, next) => {
  const parsed = residenceIdSchema.safeParse(c.req.header(RESIDENCE_HEADER));
  if (!parsed.success) {
    throw new HTTPException(400);
  }
  const residenceId = parsed.data;

  const [row] = await db
    .select({ id: schema.membership.id, role: schema.membership.role })
    .from(schema.membership)
    .where(
      and(
        eq(schema.membership.userId, c.get('user').id),
        eq(schema.membership.residenceId, residenceId),
        eq(schema.membership.active, true),
      ),
    )
    .limit(1);
  if (!row) {
    throw new HTTPException(403);
  }

  c.set('residenceId', residenceId);
  c.set('role', row.role);
  c.set('membershipId', row.id);
  await next();
});

/** Exige une permission de `@syndic/shared` pour le rôle de l'utilisateur (après `requireMembership`). */
export const requirePermission = (permission: Permission) =>
  createMiddleware<MembershipEnv>(async (c, next) => {
    if (!can(c.get('role'), permission)) {
      throw new HTTPException(403);
    }
    await next();
  });
