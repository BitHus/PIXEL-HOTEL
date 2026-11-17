import { describe, expect, it } from 'vitest';
import { checkLogin, createSession, registerAccount } from './accounts.ts';
import { setPassword } from './admin.ts';
import { openDb } from './db.ts';

describe('admin setPassword', () => {
  it('replaces the password and ends sessions', async () => {
    const db = openDb(':memory:');
    const r = await registerAccount(db, { username: 'Tilda', password: 'old-password-1', age13: true }, 4, 1000);
    expect(r.ok).toBe(true);
    createSession(db, (r as { accountId: number }).accountId, 'ip', 30, 1000);
    expect(await setPassword(db, 'Tilda', 'brand-new-pass-2', 4)).toEqual({ ok: true });
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
    expect((await checkLogin(db, 'Tilda', 'old-password-1', 4)).ok).toBe(false);
    expect((await checkLogin(db, 'Tilda', 'brand-new-pass-2', 4)).ok).toBe(true);
  });
  it('refuses unknown users and weak passwords', async () => {
    const db = openDb(':memory:');
    expect(await setPassword(db, 'nobody', 'long-enough-pw', 4)).toEqual({ ok: false, error: 'no_such_user' });
    expect(await setPassword(db, 'nobody', 'short', 4)).toEqual({ ok: false, error: 'password_short' });
    expect(await setPassword(db, 5, 'long-enough-pw', 4)).toEqual({ ok: false, error: 'username_type' });
  });
});
