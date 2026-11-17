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
