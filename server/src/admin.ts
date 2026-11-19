// Admin actions run on the VPS by hand (docs/OPS.md): set a new password for a user (no email reset exists, CLAUDE.md 13).
import bcrypt from 'bcryptjs';
import { passwordProblem } from './accounts.ts';
import type { Db } from './db.ts';

export type SetPasswordResult = { ok: true } | { ok: false; error: 'no_such_user' | 'username_type' | NonNullable<ReturnType<typeof passwordProblem>> };

/** Replaces the hash and ends every session of that user (all devices must log in again). */
export async function setPassword(db: Db, username: unknown, password: unknown, cost: number): Promise<SetPasswordResult> {
  if (typeof username !== 'string' || username.length === 0 || username.length > 64) return { ok: false, error: 'username_type' };
  const pp = passwordProblem(password);
  if (pp) return { ok: false, error: pp };
  const row = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username) as { id: number } | undefined;
  if (!row) return { ok: false, error: 'no_such_user' };
  const hash = await bcrypt.hash(password as string, cost);
  db.transaction(() => {
    db.prepare('UPDATE accounts SET pw_hash = ? WHERE id = ?').run(hash, row.id);
    db.prepare('DELETE FROM sessions WHERE account_id = ?').run(row.id);
  })();
  return { ok: true };
}

/** Longest ban the CLI sets in one go (a permanent ban = delete the account). */
export const BAN_DAYS_MAX = 3650;

export type BanResult = { ok: true; until: number | null } | { ok: false; error: 'no_such_user' | 'username_type' | 'bad_days' | 'bad_reason' };

const accountId = (db: Db, username: unknown): number | 'username_type' | 'no_such_user' => {
  if (typeof username !== 'string' || username.length === 0 || username.length > 64) return 'username_type';
  const row = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username) as { id: number } | undefined;
  return row ? row.id : 'no_such_user';
};

/** Bans for `days` (1 to BAN_DAYS_MAX, whole days) with a short reason, or lifts the ban with days 0. A ban ends every session at once. */
export function setBan(db: Db, username: unknown, days: unknown, reason: unknown, now: number): BanResult {
  const id = accountId(db, username);
  if (typeof id !== 'number') return { ok: false, error: id };
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0 || days > BAN_DAYS_MAX) return { ok: false, error: 'bad_days' };
  if (days === 0) {
    db.prepare('UPDATE accounts SET banned_until = NULL, ban_reason = NULL WHERE id = ?').run(id);
    return { ok: true, until: null };
  }
  if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 200) return { ok: false, error: 'bad_reason' };
  const until = now + days * 86_400_000;
  db.transaction(() => {
    db.prepare('UPDATE accounts SET banned_until = ?, ban_reason = ? WHERE id = ?').run(until, reason.trim(), id);
    db.prepare('DELETE FROM sessions WHERE account_id = ?').run(id);
  })();
  return { ok: true, until };
}

/** Deletes an account and everything it owns (sessions, save, backups, shared rooms, blocks; reports keep the row with a NULL account). */
export function deleteAccount(db: Db, username: unknown): { ok: true } | { ok: false; error: 'no_such_user' | 'username_type' } {
  const id = accountId(db, username);
  if (typeof id !== 'number') return { ok: false, error: id };
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return { ok: true };
}
