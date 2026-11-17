// Accounts and sessions: username + password only (CLAUDE.md 13), a 13+ confirmation, bcrypt hashes, random session tokens stored only as sha256.

import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './db.ts';

const RESERVED = new Set(['admin', 'administrator', 'root', 'moderator', 'mod', 'system', 'support', 'pocketbarrel', 'owner', 'staff', 'null', 'undefined']);

/** 3 to 16 characters: letters, digits and underscore, starting with a letter. Returns an error code or null. */
export function usernameProblem(name: unknown): 'username_type' | 'username_length' | 'username_chars' | 'username_reserved' | null {
  if (typeof name !== 'string') return 'username_type';
  if (name.length < 3 || name.length > 16) return 'username_length';
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return 'username_chars';
  if (RESERVED.has(name.toLowerCase())) return 'username_reserved';
  return null;
}

/** 8 to 72 bytes (bcrypt only reads 72). No other rule: length beats complexity. */
export function passwordProblem(pw: unknown): 'password_type' | 'password_short' | 'password_long' | 'password_common' | null {
  if (typeof pw !== 'string') return 'password_type';
  if (pw.length < 8) return 'password_short';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'password_long';
  if (/^(.)\1+$/.test(pw) || ['password', '12345678', 'qwertyui', 'pocketbarrel'].includes(pw.toLowerCase())) return 'password_common';
  return null;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** IPs are only ever stored as a keyed hash. */
export function hashIp(ip: string, key: string): string {
  return createHash('sha256').update(`${key}|${ip}`).digest('hex').slice(0, 32);
}

export type RegisterResult = { ok: true; accountId: number } | { ok: false; error: string };

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

export async function checkLogin(db: Db, username: unknown, password: unknown, cost: number): Promise<{ ok: true; accountId: number; username: string } | { ok: false }> {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || Buffer.byteLength(password, 'utf8') > 72) return { ok: false };
  const row = db.prepare('SELECT id, username, pw_hash FROM accounts WHERE username = ?').get(username) as { id: number; username: string; pw_hash: string } | undefined;
  dummyHash ??= await bcrypt.hash(randomBytes(8).toString('hex'), cost);
  const good = await bcrypt.compare(password, row?.pw_hash ?? dummyHash);
  return row && good ? { ok: true, accountId: row.id, username: row.username } : { ok: false };
}

export function createSession(db: Db, accountId: number, ipHash: string, sessionDays: number, now: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at, ip_hash) VALUES (?, ?, ?, ?, ?)').run(sha256(token), accountId, now, now + sessionDays * 86_400_000, ipHash);
  db.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').run(now, accountId);
  return token;
}

/** The account of a bearer token; a valid session is renewed (sliding window). */
export function authenticate(db: Db, token: string | null, sessionDays: number, now: number): { accountId: number; username: string } | null {
  if (!token || token.length > 200) return null;
  const h = sha256(token);
  const row = db.prepare('SELECT s.account_id AS id, s.expires_at AS exp, a.username AS username FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?').get(h) as { id: number; exp: number; username: string } | undefined;
  if (!row) return null;
  if (row.exp <= now) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
    return null;
  }
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + sessionDays * 86_400_000, h);
  return { accountId: row.id, username: row.username };
}

export function endSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}
