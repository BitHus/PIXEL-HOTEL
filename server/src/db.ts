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
  // 2: visits (PLAN-ONLINE P2). A room without a row in room_shares is PRIVATE. view = the gzip JSON room view built from the owner's save.
  `CREATE TABLE room_shares (
     account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     room_id INTEGER NOT NULL,
     visibility TEXT NOT NULL CHECK (visibility IN ('code', 'public')),
     code TEXT NOT NULL UNIQUE,
     title TEXT,
     kind TEXT NOT NULL,
     owner_name TEXT NOT NULL,
     stars INTEGER NOT NULL,
     view BLOB NOT NULL,
     shared_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (account_id, room_id)
   );
   CREATE INDEX room_shares_public ON room_shares(visibility, updated_at);
   CREATE TABLE visit_blocks (
     owner_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     blocked_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, blocked_id)
   );
   CREATE TABLE reports (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     reporter_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
     target_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
     room_id INTEGER NOT NULL,
     kind TEXT NOT NULL,
     note TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     status TEXT NOT NULL
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
