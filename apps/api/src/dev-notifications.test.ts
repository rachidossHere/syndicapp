// L'endpoint de test des notifications n'existe pas en production (plan 08, étape 2).
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  auth: {
    api: { getSession: async () => ({ user: { id: 'u', name: 'u', email: 'u@test.invalid' }, session: { id: 's' } }) },
    handler: async () => new Response(null, { status: 404 }),
  },
}));

async function loadApp(nodeEnv: 'production' | 'test') {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('BETTER_AUTH_URL', nodeEnv === 'production' ? 'https://api.example.test' : 'http://localhost:3000');
  // Variables R2 factices (exigées en production par la validation de l'environnement).
  vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
  vi.stubEnv('R2_ACCESS_KEY_ID', 'fake-access-key-id-0000');
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'fake-secret-access-key-0000000000000000');
  vi.stubEnv('R2_BUCKET', 'syndicapp-fake');
  return (await import('./app')).app;
}

describe('endpoint de test des notifications', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('n’est pas monté quand NODE_ENV vaut production : 404 même avec une session', async () => {
    const app = await loadApp('production');
    const response = await app.request('/api/dev/notifications/test', { method: 'POST' });
    expect(response.status).toBe(404);
    expect(app.routes.some((route) => route.path.startsWith('/api/dev'))).toBe(false);
  });

  it('est monté hors production', async () => {
    const app = await loadApp('test');
    expect(app.routes.some((route) => route.path === '/api/dev/notifications/test')).toBe(true);
  });
});
