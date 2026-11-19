import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNewPlayer, passwordProblem as sharedPasswordProblem, toSaveText, usernameProblem as sharedUsernameProblem } from '@pixel-hotel/shared';
import { authenticate, checkLogin, createSession, passwordProblem, registerAccount, SESSIONS_PER_ACCOUNT_MAX, usernameProblem } from './accounts.ts';
import { BAN_DAYS_MAX, deleteAccount, setBan } from './admin.ts';
import { configProblems, loadConfig } from './config.ts';
import { migrate, openDb, type Db } from './db.ts';
import { createApiServer, HTTP_MAX_CONNECTIONS, HTTP_TIMEOUTS } from './http.ts';

const DAY = 86_400_000;
const GOOD_KEY = 'a'.repeat(64);

describe('config refuses an unsafe production start', () => {
  it('local dev defaults start fine', () => {
    expect(configProblems({})).toEqual([]);
  });
  it('production (trust proxy) needs a real IP key and https origins', () => {
    const prod = { PB_TRUST_PROXY: '1', PB_ORIGINS: 'https://pocketbarrel.com' };
    expect(configProblems({ ...prod, PB_IP_KEY: GOOD_KEY })).toEqual([]);
    expect(configProblems(prod).join()).toMatch(/PB_IP_KEY/);
    expect(configProblems({ ...prod, PB_IP_KEY: 'CHANGE_ME' }).join()).toMatch(/PB_IP_KEY/);
    expect(configProblems({ ...prod, PB_IP_KEY: 'short' }).join()).toMatch(/PB_IP_KEY/);
    expect(configProblems({ ...prod, PB_IP_KEY: GOOD_KEY, PB_ORIGINS: 'http://pocketbarrel.com' }).join()).toMatch(/PB_ORIGINS/);
  });
  it('a public bind needs PB_ALLOW_PUBLIC=1; silly limits are refused', () => {
    expect(configProblems({ PB_HOST: '0.0.0.0' }).join()).toMatch(/PB_HOST/);
    expect(configProblems({ PB_HOST: '0.0.0.0', PB_ALLOW_PUBLIC: '1' })).toEqual([]);
    expect(configProblems({ PB_SAVE_MAX_BYTES: '50' }).join()).toMatch(/SAVE_MAX/);
    expect(configProblems({ PB_SESSION_DAYS: '0' }).join()).toMatch(/SESSION_DAYS/);
    expect(configProblems({ PB_BACKUPS_KEPT: '0' }).join()).toMatch(/BACKUPS_KEPT/);
    expect(configProblems({ PB_PORT: '70000' }).join()).toMatch(/PB_PORT/);
  });
});

describe('migration 3 (bans)', () => {
  it('an existing database at version 2 gets the ban columns and keeps its accounts', () => {
    const db = openDb(':memory:');
    db.exec('ALTER TABLE accounts DROP COLUMN ban_reason; ALTER TABLE accounts DROP COLUMN banned_until; UPDATE schema_version SET v = 2');
    db.prepare("INSERT INTO accounts (username, pw_hash, created_at, age_ok, age_ok_at) VALUES ('Old', 'h', 0, 1, 0)").run();
    migrate(db);
    expect((db.prepare('SELECT v FROM schema_version').get() as { v: number }).v).toBe(3);
    expect(db.prepare("SELECT username, banned_until, ban_reason FROM accounts WHERE username = 'Old'").get()).toEqual({ username: 'Old', banned_until: null, ban_reason: null });
    db.close();
  });
});

describe('account rules are the shared ones', () => {
  it('the server uses the exact functions of shared/src/net/protocol.ts', () => {
    expect(usernameProblem).toBe(sharedUsernameProblem);
    expect(passwordProblem).toBe(sharedPasswordProblem);
  });
});

describe('sessions per account', () => {
  it(`keeps at most ${SESSIONS_PER_ACCOUNT_MAX}: a new login ends the oldest`, async () => {
    const db = openDb(':memory:');
    const r = await registerAccount(db, { username: 'Mira', password: 'long-enough-pw', age13: true }, 4, 0);
    const id = (r as { accountId: number }).accountId;
    const tokens: string[] = [];
    for (let i = 0; i < SESSIONS_PER_ACCOUNT_MAX + 3; i++) tokens.push(createSession(db, id, 'ip', 30, 1000 + i));
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(SESSIONS_PER_ACCOUNT_MAX);
    expect(authenticate(db, tokens[0]!, 30, 2000)).toBeNull();
    expect(authenticate(db, tokens[2]!, 30, 2000)).toBeNull();
    expect(authenticate(db, tokens.at(-1)!, 30, 2000)?.username).toBe('Mira');
    expect(authenticate(db, tokens[3]!, 30, 2000)?.username).toBe('Mira');
    db.close();
  });
});

describe('admin bans and deletes (pure, :memory:)', () => {
  it('a ban ends sessions, blocks login until it runs out; unban lifts it', async () => {
    const db = openDb(':memory:');
    const r = await registerAccount(db, { username: 'Rook', password: 'long-enough-pw', age13: true }, 4, 0);
    const token = createSession(db, (r as { accountId: number }).accountId, 'ip', 30, 0);
    const ban = setBan(db, 'Rook', 2, 'spam names', 1000);
    expect(ban).toEqual({ ok: true, until: 1000 + 2 * DAY });
    expect(authenticate(db, token, 30, 2000)).toBeNull();
    expect(await checkLogin(db, 'Rook', 'long-enough-pw', 4, 2000)).toEqual({ ok: false, banned: true });
    // A wrong password never says "banned" (no hint to a guesser).
    expect(await checkLogin(db, 'Rook', 'wrong-password', 4, 2000)).toEqual({ ok: false });
    expect((await checkLogin(db, 'Rook', 'long-enough-pw', 4, 1000 + 2 * DAY)).ok).toBe(true);
    setBan(db, 'Rook', 5, 'again', 0);
    expect(setBan(db, 'Rook', 0, undefined, 0)).toEqual({ ok: true, until: null });
    expect((await checkLogin(db, 'Rook', 'long-enough-pw', 4, 10)).ok).toBe(true);
    db.close();
  });
  it('refuses bad ban input', async () => {
    const db = openDb(':memory:');
    await registerAccount(db, { username: 'Rook', password: 'long-enough-pw', age13: true }, 4, 0);
    expect(setBan(db, 'nobody', 1, 'x', 0)).toEqual({ ok: false, error: 'no_such_user' });
    expect(setBan(db, 7, 1, 'x', 0)).toEqual({ ok: false, error: 'username_type' });
    expect(setBan(db, 'Rook', 1.5, 'x', 0)).toEqual({ ok: false, error: 'bad_days' });
    expect(setBan(db, 'Rook', -1, 'x', 0)).toEqual({ ok: false, error: 'bad_days' });
    expect(setBan(db, 'Rook', BAN_DAYS_MAX + 1, 'x', 0)).toEqual({ ok: false, error: 'bad_days' });
    expect(setBan(db, 'Rook', 1, '  ', 0)).toEqual({ ok: false, error: 'bad_reason' });
    expect(setBan(db, 'Rook', 1, 'x'.repeat(201), 0)).toEqual({ ok: false, error: 'bad_reason' });
    db.close();
  });
  it('delete-user removes the account with its sessions and save', async () => {
    const db = openDb(':memory:');
    const r = await registerAccount(db, { username: 'Gone', password: 'long-enough-pw', age13: true }, 4, 0);
    const id = (r as { accountId: number }).accountId;
    createSession(db, id, 'ip', 30, 0);
    db.prepare('INSERT INTO saves (account_id, revision, version, saved_at, blob) VALUES (?, 1, 1, 0, ?)').run(id, Buffer.from('x'));
    expect(deleteAccount(db, 'gone')).toEqual({ ok: true });
    for (const t of ['accounts', 'sessions', 'saves']) expect((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
    expect(deleteAccount(db, 'gone')).toEqual({ ok: false, error: 'no_such_user' });
    db.close();
  });
});

describe('HTTP: bans and server limits', () => {
  let db: Db;
  let base = '';
  let server: ReturnType<typeof createApiServer>;
  let now = 1_800_000_000_000;
  beforeEach(async () => {
    now = 1_800_000_000_000;
    db = openDb(':memory:');
    server = createApiServer({ config: loadConfig({ PB_BCRYPT_COST: '4', PB_IP_KEY: 'test-key' }), db, now: () => now });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('a banned player gets 403 banned at login and 401 on every call with an old token', async () => {
    const reg = await post('/api/register', { username: 'Rook', password: 'long-enough-pw', age13: true });
    const { token } = (await reg.json()) as { token: string };
    const put = (text: string) => fetch(`${base}/api/save`, { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: text });
    expect((await put(toSaveText(createNewPlayer(undefined, 0), now))).status).toBe(200);
    setBan(db, 'Rook', 1, 'test', now);
    expect((await fetch(`${base}/api/save/meta`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
    const login = await post('/api/login', { username: 'Rook', password: 'long-enough-pw' });
    expect(login.status).toBe(403);
    expect(await login.json()).toEqual({ error: 'banned' });
    now += DAY;
    expect((await post('/api/login', { username: 'Rook', password: 'long-enough-pw' })).status).toBe(200);
  });

  it('slow clients are cut off and open sockets are capped', () => {
    expect(server.requestTimeout).toBe(HTTP_TIMEOUTS.requestMs);
    expect(server.headersTimeout).toBe(HTTP_TIMEOUTS.headersMs);
    expect(server.keepAliveTimeout).toBe(HTTP_TIMEOUTS.keepAliveMs);
    expect(server.maxConnections).toBe(HTTP_MAX_CONNECTIONS);
  });
});
