import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

/** Valide le corps JSON avec un schéma Zod de `@syndic/shared` ; 400 `bad_request` sinon. */
export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400);
  }
  return result.data;
}
