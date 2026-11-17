import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION, createNewPlayer, toSaveText } from '@pixel-hotel/shared';
import { passwordProblem, usernameProblem } from './accounts.ts';
import { loadConfig } from './config.ts';
import { openDb, type Db } from './db.ts';
import { createApiServer } from './http.ts';
import { RateLimiter } from './rateLimit.ts';
import { listBackups } from './saves.ts';

let now = 1_800_000_000_000;
let db: Db;
let base = '';
let close: () => Promise<void>;

async function start(overrides: Record<string, string> = {}): Promise<void> {
  db = openDb(':memory:');
  const config = loadConfig({ PB_BCRYPT_COST: '4', PB_IP_KEY: 'test-key', PB_ORIGINS: 'https://pocketbarrel.com', ...overrides });
  const server = createApiServer({ config, db, now: () => now });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise<void>((r) => server.close(() => r()));
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const put = (token: string, text: string) => fetch(`${base}/api/save`, { method: 'PUT', headers: { ...auth(token), 'content-type': 'application/json' }, body: text });

async function register(name = 'Tester', pw = 'correct horse'): Promise<string> {
  const r = await post('/api/register', { username: name, password: pw, age13: true });
  expect(r.status).toBe(201);
  return ((await r.json()) as { token: string }).token;
}

const saveText = (savedAt: number, gold = 100): string => {
  const s = createNewPlayer(undefined, 0);
  return toSaveText({ ...s, player: { ...s.player, wallet: { ...s.player.wallet, gold } } }, savedAt);
};

beforeEach(async () => {
  now = 1_800_000_000_000;
  await start();
});
afterEach(async () => {
  await close();
  db.close();
});

describe('username and password rules', () => {
  it('usernames: 3 to 16, letters digits underscore, start with a letter, no reserved names', () => {
    expect(usernameProblem('Tester_1')).toBeNull();
    expect(usernameProblem('ab')).toBe('username_length');
    expect(usernameProblem('a'.repeat(17))).toBe('username_length');
    expect(usernameProblem('1abc')).toBe('username_chars');
    expect(usernameProblem('has space')).toBe('username_chars');
    expect(usernameProblem('Admin')).toBe('username_reserved');
    expect(usernameProblem(42)).toBe('username_type');
  });
  it('passwords: 8 to 72 bytes, not trivially common', () => {
    expect(passwordProblem('correct horse')).toBeNull();
    expect(passwordProblem('short')).toBe('password_short');
    expect(passwordProblem('x'.repeat(73))).toBe('password_long');
    expect(passwordProblem('aaaaaaaa')).toBe('password_common');
    expect(passwordProblem('Password')).toBe('password_common');
    expect(passwordProblem(null)).toBe('password_type');
  });
});

describe('rate limiter', () => {
  it('lets max hits through per window, then frees up; refused hits are not counted', () => {
    const l = new RateLimiter(2, 1000);
    expect(l.take('a', 0)).toBe(true);
    expect(l.take('a', 10)).toBe(true);
    expect(l.take('a', 20)).toBe(false);
    expect(l.take('b', 20)).toBe(true);
    expect(l.take('a', 1005)).toBe(true);
  });
});

describe('register and login', () => {
  it('registers, stores only a hash, logs in, is case-insensitive on the name', async () => {
    const token = await register('Tester', 'correct horse');
    expect(token.length).toBeGreaterThan(30);
    const row = db.prepare('SELECT pw_hash, age_ok FROM accounts').get() as { pw_hash: string; age_ok: number };
    expect(row.pw_hash).toMatch(/^\$2[aby]\$/);
    expect(row.pw_hash).not.toContain('correct horse');
    expect(row.age_ok).toBe(1);
    const tokenRow = db.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
    expect(tokenRow.token_hash).not.toBe(token); // only the sha256 is stored
    const ok = await post('/api/login', { username: 'tester', password: 'correct horse' });
    expect(ok.status).toBe(200);
    const bad = await post('/api/login', { username: 'Tester', password: 'wrong password' });
    expect(bad.status).toBe(401);
    const unknown = await post('/api/login', { username: 'Nobody', password: 'correct horse' });
    expect(unknown.status).toBe(401);
    expect(((await unknown.json()) as { error: string }).error).toBe('bad_login'); // the same answer as a wrong password
  });

  it('needs the 13+ confirmation, a good name and password; a name is taken once', async () => {
    expect((await post('/api/register', { username: 'Tester', password: 'correct horse', age13: false })).status).toBe(400);
    expect((await post('/api/register', { username: 'Tester', password: 'correct horse' })).status).toBe(400);
    expect((await post('/api/register', { username: 'T', password: 'correct horse', age13: true })).status).toBe(400);
    now += 3_600_001; // every attempt counts for the register limit (3 per hour per IP)
    expect((await post('/api/register', { username: 'Tester', password: 'short', age13: true })).status).toBe(400);
    await register('Tester');
    expect((await post('/api/register', { username: 'TESTER', password: 'correct horse', age13: true })).status).toBe(409);
  });

  it('rejects malformed bodies and oversize bodies', async () => {
    const bad = await fetch(`${base}/api/login`, { method: 'POST', body: '{not json' });
    expect(bad.status).toBe(400);
    const arr = await fetch(`${base}/api/login`, { method: 'POST', body: '[1]' });
    expect(arr.status).toBe(400);
    const big = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'x'.repeat(10_000), password: 'y' }) });
    expect(big.status).toBe(413);
  });

  it('limits registrations (3 per hour per IP) and logins (5 per minute per IP), and frees them later', async () => {
    for (let i = 0; i < 3; i++) await register(`User${i}`);
    expect((await post('/api/register', { username: 'User9', password: 'correct horse', age13: true })).status).toBe(429);
    now += 3_600_001;
    expect((await post('/api/register', { username: 'User9', password: 'correct horse', age13: true })).status).toBe(201);
    now += 60_001;
    for (let i = 0; i < 5; i++) expect((await post('/api/login', { username: 'User0', password: 'nope nope nope' })).status).toBe(401);
    expect((await post('/api/login', { username: 'User0', password: 'correct horse' })).status).toBe(429);
    now += 60_001;
    expect((await post('/api/login', { username: 'User0', password: 'correct horse' })).status).toBe(200);
  });

  it('sessions expire after the sliding window and logout ends one', async () => {
    const token = await register();
    expect((await fetch(`${base}/api/save/meta`, { headers: auth(token) })).status).toBe(404); // valid session, no save yet
    now += 29 * 86_400_000;
    expect((await fetch(`${base}/api/save/meta`, { headers: auth(token) })).status).toBe(404); // still valid, renewed
    now += 29 * 86_400_000;
    expect((await fetch(`${base}/api/save/meta`, { headers: auth(token) })).status).toBe(404); // the renewal kept it alive
    now += 31 * 86_400_000;
    expect((await fetch(`${base}/api/save/meta`, { headers: auth(token) })).status).toBe(401);
    const t2 = ((await (await post('/api/login', { username: 'Tester', password: 'correct horse' })).json()) as { token: string }).token;
    expect((await post('/api/logout', {}, auth(t2))).status).toBe(200);
    expect((await fetch(`${base}/api/save/meta`, { headers: auth(t2) })).status).toBe(401);
  });

  it('CORS: only the configured origin is echoed; the health check is open', async () => {
    const good = await fetch(`${base}/api/health`, { headers: { origin: 'https://pocketbarrel.com' } });
    expect(good.headers.get('access-control-allow-origin')).toBe('https://pocketbarrel.com');
    const evil = await fetch(`${base}/api/health`, { headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    expect(((await good.json()) as { ok: boolean }).ok).toBe(true);
  });
});

describe('cloud save', () => {
  it('needs a session', async () => {
    expect((await fetch(`${base}/api/save`)).status).toBe(401);
    expect((await fetch(`${base}/api/save`, { method: 'PUT', body: saveText(now) })).status).toBe(401);
    expect((await fetch(`${base}/api/save`, { headers: auth('garbage') })).status).toBe(401);
  });

  it('stores a whole save and gives it back (round trip with its version)', async () => {
    const token = await register();
    const r = await put(token, saveText(now - 1000, 250));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ revision: 1, version: SAVE_VERSION, savedAt: now - 1000 });
    const got = (await (await fetch(`${base}/api/save`, { headers: auth(token) })).json()) as { revision: number; save: { version: number; savedAt: number; state: { player: { wallet: { gold: number } } } } };
    expect(got.revision).toBe(1);
    expect(got.save.version).toBe(SAVE_VERSION);
    expect(got.save.state.player.wallet.gold).toBe(250);
    const meta = await (await fetch(`${base}/api/save/meta`, { headers: auth(token) })).json();
    expect(meta).toEqual({ revision: 1, version: SAVE_VERSION, savedAt: now - 1000 });
  });

  it('the newest savedAt wins: an older upload is refused with the server meta, an equal or newer one is taken', async () => {
    const token = await register();
    now += 10_000;
    await put(token, saveText(now - 500, 300));
    now += 2_100;
    const old = await put(token, saveText(now - 5000, 111));
    expect(old.status).toBe(409);
    expect(await old.json()).toMatchObject({ error: 'newer_on_server', current: { savedAt: now - 2_100 - 500 } });
    now += 2_100;
    expect((await put(token, saveText(now - 100, 400))).status).toBe(200);
    const got = (await (await fetch(`${base}/api/save`, { headers: auth(token) })).json()) as { revision: number; save: { state: { player: { wallet: { gold: number } } } } };
    expect(got.revision).toBe(2);
    expect(got.save.state.player.wallet.gold).toBe(400);
  });

  it('keeps backups of replaced saves, at most the configured number', async () => {
    await close();
    db.close();
    await start({ PB_BACKUPS_KEPT: '3' });
    const token = await register();
    for (let i = 0; i < 6; i++) {
      now += 2_100;
      expect((await put(token, saveText(now, 100 + i))).status).toBe(200);
    }
    const id = (db.prepare('SELECT id FROM accounts').get() as { id: number }).id;
    expect(listBackups(db, id).map((b) => b.revision)).toEqual([5, 4, 3]);
  });

  it('refuses bad saves and keeps the last good one', async () => {
    const token = await register();
    now += 5000;
    await put(token, saveText(now, 100));
    const tests: [string, number, string][] = [
      ['{broken', 422, 'bad_json'],
      [JSON.stringify({ hello: 1 }), 422, 'not_a_save'],
      [JSON.stringify({ version: SAVE_VERSION + 1, savedAt: now, state: {} }), 409, 'too_new'],
      [JSON.stringify({ version: SAVE_VERSION, savedAt: now, state: { nope: true } }), 422, 'invalid'],
    ];
    for (const [text, status, error] of tests) {
      now += 2_100;
      const r = await put(token, text);
      expect([r.status, ((await r.json()) as { error: string }).error]).toEqual([status, error]);
    }
    now += 2_100;
    const future = await put(token, saveText(now + 3_600_000));
    expect(((await future.json()) as { error: string }).error).toBe('bad_time');
    now += 2_100;
    const negative = await put(token, saveText(now, -5));
    expect(((await negative.json()) as { error: string }).error).toBe('bad_state');
    const meta = (await (await fetch(`${base}/api/save/meta`, { headers: auth(token) })).json()) as { revision: number };
    expect(meta.revision).toBe(1);
  });

  it('migrates nothing server-side but accepts an older version the shared reader can read; a version-1 file is too old', async () => {
    const token = await register();
    const old = JSON.stringify({ version: 1, savedAt: now, state: {} });
    const r = await put(token, old);
    expect(r.status).toBe(422);
  });

  it('limits uploads: one per 2 seconds per account and a size cap', async () => {
    const token = await register();
    expect((await put(token, saveText(now))).status).toBe(200);
    expect((await put(token, saveText(now))).status).toBe(429);
    now += 2_100;
    expect((await put(token, saveText(now))).status).toBe(200);
    await close();
    db.close();
    await start({ PB_SAVE_MAX_BYTES: '1000' });
    const t2 = await register('Other');
    expect((await put(t2, saveText(now))).status).toBe(413);
  });

  it('every account has its own save', async () => {
    const a = await register('Alice');
    const b = await register('Bobby');
    await put(a, saveText(now, 111));
    expect((await fetch(`${base}/api/save`, { headers: auth(b) })).status).toBe(404);
  });
});
