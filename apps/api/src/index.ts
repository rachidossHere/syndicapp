import { serve } from '@hono/node-server';
import { closeDb } from '@syndic/db';

import { app } from './app';
import { env } from './env';

// 0.0.0.0 : joignable depuis le téléphone sur le même réseau local.
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`[api] à l'écoute sur http://0.0.0.0:${info.port} (${env.NODE_ENV})`);
});

const shutdown = () => {
  server.close(() => {
    // Ferme les connexions WebSocket vers Neon avant de quitter.
    void closeDb().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
