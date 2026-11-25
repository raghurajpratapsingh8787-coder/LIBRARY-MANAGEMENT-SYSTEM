import { createAppServer } from './backend/src/app';
import { disconnectDatabase } from './backend/src/config/db';
import { env } from './backend/src/config/env';

createAppServer()
  .then(({ server }) => {
    server.listen(env.port, '0.0.0.0', () => {
      console.log(`Folio Ledger server listening on http://0.0.0.0:${env.port}`);
    });

    const shutdown = async () => {
      server.close();
      await disconnectDatabase();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error('Failed to start Folio Ledger server:', err);
    process.exit(1);
  });
