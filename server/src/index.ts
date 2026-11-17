// PocketBarrel server (stage A of docs/PLAN-ONLINE.md): accounts and cloud saves over HTTP. Config from the environment only (config.ts).
// Run: npm run server (needs PB_IP_KEY in production; PB_ORIGINS = the client origin).

import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { createApiServer } from './http.ts';

const config = loadConfig();
const db = openDb(config.dbPath);
const server = createApiServer({ config, db, now: () => Date.now() });
server.listen(config.port, config.host, () => {
  console.log(`pb-server listening on ${config.host}:${config.port}`);
});

const stop = (): void => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
