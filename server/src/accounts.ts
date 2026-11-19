// Accounts and sessions: username + password only (CLAUDE.md 13), a 13+ confirmation, bcrypt hashes, random session tokens stored only as sha256.

import { passwordProblem, usernameProblem, type PasswordProblem, type UsernameProblem } from '@pixel-hotel/shared';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './db.ts';

// The account rules are the shared ones (shared/src/net/protocol.ts), so the client can check early with the same code.
export { passwordProblem, usernameProblem };

/** Live sessions kept per account; a new login past this ends the oldest (a stolen-token list cannot grow forever). */
export const SESSIONS_PER_ACCOUNT_MAX = 10;

/** True while an account is banned at `now` (banned_until in ms; null = not banned). */
export function isBanned(bannedUntil: number | null | undefined, now: number): boolean {
  return typeof bannedUntil === 'number' && bannedUntil > now;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** IPs are only ever stored as a keyed hash. */
export function hashIp(ip: string, key: string): string {
  return createHash('sha256').update(`${key}|${ip}`).digest('hex').slice(0, 32);
}

export type RegisterResult = { ok: true; accountId: number } | { ok: false; error: 'age_required' | 'username_taken' | UsernameProblem | PasswordProblem };

export async function registerAccount(db: Db, input: { username: unknown; password: unknown; age13: unknown }, cost: number, now: number): Promise<RegisterResult> {
  if (input.age13 !== true) return { ok: false, error: 'age_required' };
  const up = usernameProblem(input.username);
  if (up) return { ok: false, error: up };
  const pp = passwordProblem(input.password);
  if (pp) return { ok: false, error: pp };
  const username = input.username as string;
  const exists = db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username);
  if (exists) return { ok: false, error: 'username_taken' };
  const hash = await bcrypt.hash(input.password as string, cost);
  try {
    const r = db.prepare('INSERT INTO accounts (username, pw_hash, created_at, age_ok, age_ok_at) VALUES (?, ?, ?, 1, ?)').run(username, hash, now, now);
    return { ok: true, accountId: Number(r.lastInsertRowid) };
  } catch {
    return { ok: false, error: 'username_taken' };
  }
}

// A valid hash of a random value: an unknown username then costs the same time as a wrong password.
let dummyHash: string | null = null;

/** A right password of a banned account answers `banned` (only after the password matched, so a ban never tells a guesser a name exists). */
export async function checkLogin(
  db: Db, username: unknown, password: unknown, cost: number, now = 0,
): Promise<{ ok: true; accountId: number; username: string } | { ok: false; banned?: true }> {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || Buffer.byteLength(password, 'utf8') > 72) return { ok: false };
  const row = db.prepare('SELECT id, username, pw_hash, banned_until FROM accounts WHERE username = ?').get(username) as
    | { id: number; username: string; pw_hash: string; banned_until: number | null }
    | undefined;
  dummyHash ??= await bcrypt.hash(randomBytes(8).toString('hex'), cost);
  const good = await bcrypt.compare(password, row?.pw_hash ?? dummyHash);
  if (!row || !good) return { ok: false };
  if (isBanned(row.banned_until, now)) return { ok: false, banned: true };
  return { ok: true, accountId: row.id, username: row.username };
}

export function createSession(db: Db, accountId: number, ipHash: string, sessionDays: number, now: number): string {
  const token = randomBytes(32).toString('base64url');
  db.transaction(() => {
    db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at, ip_hash) VALUES (?, ?, ?, ?, ?)').run(sha256(token), accountId, now, now + sessionDays * 86_400_000, ipHash);
    db.prepare(
      'DELETE FROM sessions WHERE account_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
    ).run(accountId, accountId, SESSIONS_PER_ACCOUNT_MAX);
    db.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').run(now, accountId);
  })();
  return token;
}

/** The account of a bearer token; a valid session is renewed (sliding window). */
export function authenticate(db: Db, token: string | null, sessionDays: number, now: number): { accountId: number; username: string } | null {
  if (!token || token.length > 200) return null;
  const h = sha256(token);
  const row = db
    .prepare('SELECT s.account_id AS id, s.expires_at AS exp, a.username AS username, a.banned_until AS bannedUntil FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?')
    .get(h) as { id: number; exp: number; username: string; bannedUntil: number | null } | undefined;
  if (!row) return null;
  if (row.exp <= now || isBanned(row.bannedUntil, now)) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
    return null;
  }
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + sessionDays * 86_400_000, h);
  return { accountId: row.id, username: row.username };
}

export function endSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}
