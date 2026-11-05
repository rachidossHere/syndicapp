import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { isProduction } from './env';
import { requestLogger } from './middleware/request-logger';
import { health } from './routes/health';

export const app = new Hono();

app.use(requestLogger());

// Les applis mobiles ne sont pas soumises à CORS : il ne sert qu'au navigateur en développement.
if (!isProduction) {
  app.use(cors());
}

app.route('/health', health);

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
  // Le détail (message SQL, stack trace) ne va que dans les logs du serveur.
  console.error(`[api] erreur non gérée sur ${c.req.method} ${c.req.path} :`, error);
  return c.json({ error: 'internal_error' }, 500);
});
