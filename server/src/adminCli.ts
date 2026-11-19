// Usage on the VPS (env from /etc/pocketbarrel.env, run as the pocketbarrel user from /opt/pocketbarrel/current):
//   node --import tsx server/src/adminCli.ts set-password <username>     (the new password on stdin)
//   node --import tsx server/src/adminCli.ts ban <username> <days> <reason...>
//   node --import tsx server/src/adminCli.ts unban <username>
//   node --import tsx server/src/adminCli.ts delete-user <username> --yes
// A password is read from stdin (one line, never from argv, so it stays out of the process list and shell history).
import { createInterface } from 'node:readline';
import { deleteAccount, setBan, setPassword } from './admin.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';

const [cmd, username, ...rest] = process.argv.slice(2);
const usage = (): never => {
  console.error('usage: adminCli.ts set-password <username> | ban <username> <days> <reason> | unban <username> | delete-user <username> --yes');
  process.exit(2);
};
if (!username) usage();
const config = loadConfig();

const fail = (error: string): never => {
  console.error(`failed: ${error}`);
  process.exit(1);
};

if (cmd === 'set-password') {
  const rl = createInterface({ input: process.stdin });
  const line = await new Promise<string>((res) => {
    rl.once('line', res);
    rl.once('close', () => res(''));
  });
  rl.close();
  const db = openDb(config.dbPath);
  const r = await setPassword(db, username, line, config.bcryptCost);
  db.close();
  if (!r.ok) fail(r.error);
  console.log(`password set for ${username}; all sessions ended`);
} else if (cmd === 'ban' || cmd === 'unban') {
  const days = cmd === 'unban' ? 0 : Number(rest[0]);
  const db = openDb(config.dbPath);
  const r = setBan(db, username, days, rest.slice(1).join(' '), Date.now());
  db.close();
  if (!r.ok) fail(r.error);
  else console.log(r.until === null ? `${username} unbanned` : `${username} banned until ${new Date(r.until).toISOString()}; all sessions ended`);
} else if (cmd === 'delete-user') {
  if (rest[0] !== '--yes') usage();
  const db = openDb(config.dbPath);
  const r = deleteAccount(db, username);
  db.close();
  if (!r.ok) fail(r.error);
  console.log(`${username} deleted with its save, backups and shared rooms`);
} else usage();
