// SQLite (better-sqlite3, synchronous). Numbered migrations run in order; schema_version remembers where we are.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

const MIGRATIONS: readonly string[] = [
  // 1: accounts, sessions, saves, save backups (PLAN-ONLINE section 2, stage A)
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     pw_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     age_ok INTEGER NOT NULL,
     age_ok_at INTEGER NOT NULL,
     last_login INTEGER
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     ip_hash TEXT NOT NULL
   );
   CREATE INDEX sessions_account ON sessions(account_id);
   CREATE TABLE saves (
     account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
     revision INTEGER NOT NULL,
     version INTEGER NOT NULL,
     saved_at INTEGER NOT NULL,
     blob BLOB NOT NULL
   );
   CREATE TABLE save_backups (
     account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     revision INTEGER NOT NULL,
     version INTEGER NOT NULL,
     saved_at INTEGER NOT NULL,
     blob BLOB NOT NULL,
     PRIMARY KEY (account_id, revision)
   );`,
];

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT v FROM schema_version').get() as { v: number } | undefined;
  let v = row?.v ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
  for (; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.prepare('UPDATE schema_version SET v = ?').run(v + 1);
    })();
  }
}
