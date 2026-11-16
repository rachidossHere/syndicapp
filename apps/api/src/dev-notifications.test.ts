// Les routes de développement des notifications ne sont pas montées en production (plan 08).
// Test de la décision de montage seule (dev-routes.ts) : pas de réimport de toute l'API.
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { mountDevRoutes } from './dev-routes';

vi.mock('./auth', () => ({
  auth: {
    api: { getSession: async () => ({ user: { id: 'u', name: 'u', email: 'u@test.invalid' }, session: { id: 's' } }) },
    handler: async () => new Response(null, { status: 404 }),
  },
}));

describe('routes de développement des notifications', () => {
  it('ne sont pas montées en production : 404 même avec une session', async () => {
    const app = new Hono();
    expect(mountDevRoutes(app, true)).toBe(false);
    const response = await app.request('/api/dev/notifications/test', { method: 'POST' });
    expect(response.status).toBe(404);
    expect(app.routes.some((route) => route.path.startsWith('/api/dev'))).toBe(false);
  });

  it('sont montées hors production', () => {
    const app = new Hono();
    expect(mountDevRoutes(app, false)).toBe(true);
    expect(app.routes.some((route) => route.path === '/api/dev/notifications/test')).toBe(true);
  });
});
