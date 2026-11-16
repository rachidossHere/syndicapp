// Routes réservées au développement. La décision de montage est isolée ici pour pouvoir la tester
// sans importer toute l'API : en production, rien n'est monté.
import type { Hono } from 'hono';

import { devNotifications } from './routes/dev-notifications';

/** Monte les routes de développement, sauf en production. Renvoie vrai si elles sont montées. */
export function mountDevRoutes(app: Hono, production: boolean): boolean {
  if (production) return false;
  app.route('/api/dev/notifications', devNotifications);
  return true;
}
