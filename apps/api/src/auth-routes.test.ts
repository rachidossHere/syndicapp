// Routes de Better Auth : seules celles du MVP sont ouvertes. Requêtes traitées dans le processus
// (app.request), sans serveur ni base de données : aucune route testée n'ouvre de connexion.
import { describe, expect, it } from 'vitest';

import { app } from './app';
import { auth } from './auth';
import { DISABLED_AUTH_PATHS, OPEN_AUTH_PATHS } from './auth-routes';

/** Toutes les routes HTTP exposées par Better Auth (plugins compris), hors appels internes. */
function exposedPaths(): string[] {
  return Object.values(auth.api as Record<string, { path?: unknown; options?: { metadata?: { SERVER_ONLY?: boolean } } }>)
    .filter((endpoint) => typeof endpoint?.path === 'string' && !endpoint.options?.metadata?.SERVER_ONLY)
    .map((endpoint) => endpoint.path as string);
}

const post = (path: string, body: unknown = {}) =>
  app.request(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'expo-origin': 'syndicapp://' },
    body: JSON.stringify(body),
  });

describe('routes Better Auth ouvertes', () => {
  it('n’ouvre que les routes du MVP : toute nouvelle route doit être classée explicitement', () => {
    const disabled = new Set<string>(DISABLED_AUTH_PATHS);
    const open = exposedPaths().filter((path) => !disabled.has(path)).sort();
    expect(open).toEqual([...OPEN_AUTH_PATHS].sort());
  });

  it('ne désactive que des routes qui existent (liste à jour)', () => {
    const exposed = new Set(exposedPaths());
    expect(DISABLED_AUTH_PATHS.filter((path) => !exposed.has(path))).toEqual([]);
  });

  it.each([
    ['/update-user', { name: 'X' }],
    ['/change-password', { currentPassword: '12345678', newPassword: `${'ب'.repeat(36)}a` }],
    ['/delete-user', {}],
    ['/change-email', { newEmail: 'autre@example.com' }],
    ['/request-password-reset', { email: 'test@example.com', redirectTo: 'syndicapp://reset' }],
    ['/reset-password', { newPassword: '12345678', token: 'jeton' }],
    ['/send-verification-email', { email: 'test@example.com' }],
    ['/verify-email', {}],
  ])('%s répond 404', async (path, body) => {
    const response = await (path === '/verify-email'
      ? app.request(`/api/auth${path}?token=jeton`)
      : post(path, body));
    expect(response.status).toBe(404);
  });

  it.each(['/reset-password/jeton-quelconque', '/callback/google', '/route-inconnue'])(
    '%s (chemin à paramètre ou inconnu) répond 404',
    async (path) => {
      expect((await app.request(`/api/auth${path}`)).status).toBe(404);
      expect((await post(path)).status).toBe(404);
    },
  );

  it('/ok reste ouverte', async () => {
    const response = await app.request('/api/auth/ok');
    expect(response.status).toBe(200);
  });
});
