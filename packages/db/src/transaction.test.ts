// Test d'intégration : le pilote WebSocket annule bien une transaction en cas d'erreur.
// Il utilise la base de DATABASE_URL (branche Neon dev en local, AGENTS.md) et une table
// au nom aléatoire, supprimée à la fin. Sans DATABASE_URL (CI sans base), il est ignoré.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, getDb } from './client';
import { sql } from 'drizzle-orm';

const envFile = resolve(import.meta.dirname, '../../../.env.local');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('transactions (pilote WebSocket de Neon)', () => {
  const table = sql.identifier(`tx_test_${randomBytes(4).toString('hex')}`);

  const count = async () => {
    const result = await getDb().execute<{ n: number }>(sql`select count(*)::int as n from ${table}`);
    return result.rows[0]?.n;
  };

  beforeAll(async () => {
    await getDb().execute(sql`create table ${table} (id serial primary key, label text not null)`);
  });

  afterAll(async () => {
    await getDb().execute(sql`drop table if exists ${table}`);
    await closeDb();
  });

  it('annule toutes les écritures quand une erreur survient', async () => {
    await expect(
      getDb().transaction(async (tx) => {
        await tx.execute(sql`insert into ${table} (label) values ('première')`);
        await tx.execute(sql`insert into ${table} (label) values ('seconde')`);
        throw new Error('échec volontaire');
      }),
    ).rejects.toThrow('échec volontaire');

    expect(await count()).toBe(0);
  });

  it('valide les écritures quand tout se passe bien', async () => {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`insert into ${table} (label) values ('validée')`);
    });

    expect(await count()).toBe(1);
  });
});
