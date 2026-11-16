/* eslint-disable @typescript-eslint/no-explicit-any -- corps JSON de réponse non typés dans les tests */
// Tests d'intégration des jetons push et des préférences de notification (plan 08, étape 1) :
// base de DATABASE_URL (branche Neon dev). Tout ce qui est créé est supprimé à la fin.
// La session est simulée par l'en-tête x-test-user ; routes et base sont réelles.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDb, getDb, schema } from '@syndic/db';
import { NOTIFICATION_ERRORS, NOTIFICATION_TYPES } from '@syndic/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get('x-test-user');
        return id
          ? { user: { id, name: id, email: `${id}@test.invalid` }, session: { id: `s-${id}` } }
          : null;
      },
    },
    handler: async () => new Response(null, { status: 404 }),
  },
}));

const envFile = resolve(import.meta.dirname, '../../../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const configured = Boolean(process.env.DATABASE_URL);

describe.skipIf(!configured)('API des jetons push et des préférences', { timeout: 60_000 }, () => {
  const tag = randomBytes(4).toString('hex');
  const alice = `test-${tag}-alice`;
  const bob = `test-${tag}-bob`;
  const tokenOf = (name: string) => `ExponentPushToken[${tag}${name}]`;
  let app: (typeof import('./app'))['app'];
  const logs: string[] = [];

  const api = async (userId: string | null, method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-test-user'] = userId;
    const response = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, json: (text ? JSON.parse(text) : null) as any };
  };
  const tokensOf = async (userId: string) =>
    (await getDb().select({ token: schema.pushToken.token }).from(schema.pushToken).where(eq(schema.pushToken.userId, userId))).map(
      (row) => row.token,
    );

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation((...args) => void logs.push(args.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...args) => void logs.push(args.join(' ')));
    ({ app } = await import('./app'));
    await getDb()
      .insert(schema.user)
      .values([alice, bob].map((id) => ({ id, name: id, email: `${id}@test.invalid` })));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    // Les jetons et préférences partent avec l'utilisateur (suppression en cascade).
    await getDb().delete(schema.user).where(inArray(schema.user.id, [alice, bob]));
    await closeDb();
  });

  it('connexion obligatoire : 401 sur chaque route, sans résidence requise', async () => {
    for (const [method, path, body] of [
      ['POST', '/api/push-tokens', { token: tokenOf('x') }],
      ['DELETE', '/api/push-tokens', { token: tokenOf('x') }],
      ['GET', '/api/notification-preferences', undefined],
      ['PUT', '/api/notification-preferences', { type: 'issue_status', enabled: false }],
    ] as const) {
      const response = await api(null, method, path, body);
      expect({ method, path, status: response.status }).toEqual({ method, path, status: 401 });
    }
  });

  it('enregistre le jeton puis le met à jour sans doublon (sans en-tête de résidence)', async () => {
    const first = await api(alice, 'POST', '/api/push-tokens', { token: tokenOf('a'), device: 'iPhone de test' });
    expect(first.status).toBe(200);
    expect(first.text).not.toContain(tag); // le jeton n'est jamais renvoyé
    const [before] = await getDb().select().from(schema.pushToken).where(eq(schema.pushToken.token, tokenOf('a')));
    expect(before).toMatchObject({ userId: alice, device: 'iPhone de test' });

    const second = await api(alice, 'POST', '/api/push-tokens', { token: tokenOf('a'), device: 'iPhone renommé' });
    expect(second.status).toBe(200);
    const rows = await getDb().select().from(schema.pushToken).where(eq(schema.pushToken.token, tokenOf('a')));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.device).toBe('iPhone renommé');
    expect(rows[0]!.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before!.lastUsedAt.getTime());
    expect(await tokensOf(alice)).toEqual([tokenOf('a')]);
  });

  it('réattribue le jeton à un autre utilisateur (changement de compte sur le même téléphone)', async () => {
    const response = await api(bob, 'POST', '/api/push-tokens', { token: tokenOf('a') });
    expect(response.status).toBe(200);
    expect(await tokensOf(bob)).toEqual([tokenOf('a')]);
    expect(await tokensOf(alice)).toEqual([]);
  });

  it('refuse le format de jeton invalide (400) et ne crée rien', async () => {
    for (const token of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'ExponentPushToken[x', 42, null]) {
      const response = await api(alice, 'POST', '/api/push-tokens', { token });
      expect({ token, status: response.status }).toEqual({ token, status: 400 });
    }
    expect((await api(alice, 'POST', '/api/push-tokens', {})).status).toBe(400);
    expect((await api(alice, 'DELETE', '/api/push-tokens', { token: 'nimporte quoi' })).status).toBe(400);
    expect(await tokensOf(alice)).toEqual([]);
  });

  it('refuse de supprimer le jeton d’un autre (404, le jeton reste), accepte le sien', async () => {
    const refused = await api(alice, 'DELETE', '/api/push-tokens', { token: tokenOf('a') });
    expect(refused.status).toBe(404);
    expect(refused.json).toEqual({ error: NOTIFICATION_ERRORS.tokenNotFound });
    expect(await tokensOf(bob)).toEqual([tokenOf('a')]);

    const unknown = await api(alice, 'DELETE', '/api/push-tokens', { token: tokenOf('inconnu') });
    expect(unknown.status).toBe(404);

    const deleted = await api(bob, 'DELETE', '/api/push-tokens', { token: tokenOf('a') });
    expect(deleted.status).toBe(200);
    expect(await tokensOf(bob)).toEqual([]);
  });

  it('préférences : tout est activé par défaut, y compris pour un nouvel utilisateur', async () => {
    const response = await api(alice, 'GET', '/api/notification-preferences');
    expect(response.status).toBe(200);
    expect(Object.keys(response.json.preferences).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    expect(Object.values(response.json.preferences).every((value) => value === true)).toBe(true);
  });

  it('préférences : chaque utilisateur a les siennes, modifiables puis relues', async () => {
    const put = await api(alice, 'PUT', '/api/notification-preferences', { type: 'charge_reminder', enabled: false });
    expect(put.status).toBe(200);
    expect(put.json).toEqual({ type: 'charge_reminder', enabled: false });
    expect((await api(alice, 'GET', '/api/notification-preferences')).json.preferences.charge_reminder).toBe(false);
    expect((await api(bob, 'GET', '/api/notification-preferences')).json.preferences.charge_reminder).toBe(true);

    await api(alice, 'PUT', '/api/notification-preferences', { type: 'charge_reminder', enabled: true });
    expect((await api(alice, 'GET', '/api/notification-preferences')).json.preferences.charge_reminder).toBe(true);
    const rows = await getDb().select().from(schema.notificationPreference).where(eq(schema.notificationPreference.userId, alice));
    expect(rows).toHaveLength(1); // une seule ligne par type
  });

  it('les annonces urgentes ne peuvent pas être coupées (400) et restent activées', async () => {
    const response = await api(alice, 'PUT', '/api/notification-preferences', { type: 'announcement_urgent', enabled: false });
    expect(response.status).toBe(400);
    expect(response.json).toEqual({ error: NOTIFICATION_ERRORS.locked });
    expect((await api(alice, 'PUT', '/api/notification-preferences', { type: 'announcement_urgent', enabled: true })).status).toBe(200);
    expect((await api(alice, 'GET', '/api/notification-preferences')).json.preferences.announcement_urgent).toBe(true);
  });

  it('préférences : type inconnu ou valeur non booléenne refusés (400)', async () => {
    for (const body of [{ type: 'inconnu', enabled: true }, { type: 'issue_status', enabled: 'non' }, { type: 'issue_status' }, {}]) {
      expect((await api(alice, 'PUT', '/api/notification-preferences', body)).status).toBe(400);
    }
  });

  it('aucun jeton dans les journaux ni dans les réponses d’erreur', async () => {
    await api(alice, 'POST', '/api/push-tokens', { token: tokenOf('log') });
    await api(alice, 'POST', '/api/push-tokens', { token: 'ExponentPushToken[invalide espace]' });
    await api(bob, 'DELETE', '/api/push-tokens', { token: tokenOf('log') });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toContain('ExponentPushToken');
    expect(logs.join('\n')).not.toContain(tag);
  });
});
