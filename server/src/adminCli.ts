// Usage on the VPS: node --import tsx server/src/adminCli.ts set-password <username>   (env from /etc/pocketbarrel.env)
// The new password is read from stdin (one line, never from argv, so it stays out of the process list and shell history).
import { createInterface } from 'node:readline';
import { setPassword } from './admin.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';

const [cmd, username] = process.argv.slice(2);
if (cmd !== 'set-password' || !username) {
  console.error('usage: adminCli.ts set-password <username>   (password on stdin)');
  process.exit(2);
}
const config = loadConfig();
const rl = createInterface({ input: process.stdin });
const line = await new Promise<string>((res) => {
  rl.once('line', res);
  rl.once('close', () => res(''));
});
rl.close();
const db = openDb(config.dbPath);
const r = await setPassword(db, username, line, config.bcryptCost);
db.close();
if (!r.ok) {
  console.error(`failed: ${r.error}`);
  process.exit(1);
}
console.log(`password set for ${username}; all sessions ended`);
