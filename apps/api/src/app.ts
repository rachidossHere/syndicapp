import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { auth } from './auth';
import { OPEN_AUTH_PATHS } from './auth-routes';
import { withClientIp } from './client-ip';
import { isProduction } from './env';
import { describeError, formatErrorSummary } from './error-log';
import { loggablePath, requestLogger } from './middleware/request-logger';
import { chargeCalls } from './routes/charge-calls';
import { health } from './routes/health';
import { invitations } from './routes/invitations';
import { lots } from './routes/lots';
import { me } from './routes/me';
import { payments } from './routes/payments';
import { residences } from './routes/residences';

export const app = new Hono();

app.use(requestLogger());

// Les applis mobiles ne sont pas soumises à CORS : il ne sert qu'au navigateur en développement.
if (!isProduction) {
  app.use(cors());
}

// Routes publiques : santé et authentification (Better Auth gère /api/auth/*).
app.route('/health', health);
// Seuls les chemins ouverts du MVP sont transmis à Better Auth ; tout autre chemin répond 404
// (y compris ceux à paramètre, comme /reset-password/:token, que disabledPaths ne bloque pas).
const OPEN_AUTH_ROUTES = new Set<string>(OPEN_AUTH_PATHS.map((path) => `/api/auth${path}`));
app.on(['GET', 'POST'], '/api/auth/*', (c) =>
  OPEN_AUTH_ROUTES.has(c.req.path) ? auth.handler(withClientIp(c)) : c.json({ error: 'not_found' }, 404),
);

// Routes protégées : requireAuth est appliqué route par route.
app.route('/api/me', me);
app.route('/api/residences', residences);
app.route('/api/lots', lots);
app.route('/api/invitations', invitations);
app.route('/api/charge-calls', chargeCalls);
app.route('/api/payments', payments);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

const CLIENT_ERROR_CODES: Partial<Record<number, string>> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'too_many_requests',
};

app.onError((error, c) => {
  // Erreur client levée volontairement (ex. 401 plus tard) : statut conservé, code générique.
  if (error instanceof HTTPException && error.status < 500) {
    return c.json({ error: CLIENT_ERROR_CODES[error.status] ?? 'request_error' }, error.status);
  }
  // Journal : nom, code et identifiant de corrélation seulement (jamais de SQL, de paramètres
  // ni de corps de requête). L'identifiant, renvoyé au client, permet de retrouver la ligne.
  const id = randomUUID();
  console.error(
    `[api] erreur ${id} sur ${c.req.method} ${loggablePath(c.req.path)} : ${formatErrorSummary(describeError(error))}`,
  );
  return c.json({ error: 'internal_error', id }, 500);
});
