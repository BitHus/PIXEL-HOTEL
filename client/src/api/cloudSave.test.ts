import { describe, expect, it } from 'vitest';
import { CLOUD_SESSION_KEY, cloudConfig, createCloudSave, decideSync } from './cloudSave.ts';
import { memoryStorage } from './saveStorage.ts';

type Call = { url: string; method: string; auth: string | null; body: string | null };

/** A fake server: a scripted answer per "METHOD path", every call recorded. */
function fakeFetch(answers: Record<string, { status: number; body?: unknown } | 'network'>): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method, auth: headers.authorization ?? null, body: typeof init?.body === 'string' ? init.body : null });
    const key = `${method} ${new URL(url).pathname}`;
    const a = answers[key];
    if (a === 'network' || a === undefined) throw new TypeError('offline');
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const cfg = { baseUrl: 'https://server.example' };
const local = (savedAt: number) => JSON.stringify({ version: 32, savedAt, state: { a: 1 } });

describe('feature flag', () => {
  it('is off unless VITE_CLOUD_SAVE is 1 and a server URL is set', () => {
    expect(cloudConfig({})).toBeNull();
    expect(cloudConfig({ VITE_SERVER_URL: 'https://x' })).toBeNull();
    expect(cloudConfig({ VITE_CLOUD_SAVE: '1' })).toBeNull();
    expect(cloudConfig({ VITE_CLOUD_SAVE: '0', VITE_SERVER_URL: 'https://x' })).toBeNull();
    expect(cloudConfig({ VITE_CLOUD_SAVE: '1', VITE_SERVER_URL: 'https://x/' })).toEqual({ baseUrl: 'https://x' });
  });
});

describe('decideSync: the newest savedAt wins', () => {
  it('covers every case', () => {
    expect(decideSync(null, null)).toBe('none');
    expect(decideSync(5, null)).toBe('upload');
    expect(decideSync(null, 5)).toBe('download');
    expect(decideSync(9, 5)).toBe('upload');
    expect(decideSync(5, 9)).toBe('download');
    expect(decideSync(5, 5)).toBe('none');
  });
});

describe('CloudSave with a fake server', () => {
  it('register and login keep the session; logout clears it', async () => {
    const storage = memoryStorage();
    const { fn, calls } = fakeFetch({
      'POST /api/register': { status: 201, body: { token: 'T1', username: 'Tester' } },
      'POST /api/login': { status: 200, body: { token: 'T2', username: 'Tester' } },
      'POST /api/logout': { status: 200 },
    });
    const c = createCloudSave(cfg, storage, fn);
    expect(c.username()).toBeNull();
    expect(await c.register('Tester', 'correct horse', true)).toEqual({ ok: true });
    expect(c.username()).toBe('Tester');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ username: 'Tester', password: 'correct horse', age13: true });
    expect(await c.login('Tester', 'correct horse')).toEqual({ ok: true });
    expect(JSON.parse(storage.get(CLOUD_SESSION_KEY)!).token).toBe('T2');
    await c.logout();
    expect(c.username()).toBeNull();
    expect(calls.at(-1)).toMatchObject({ url: 'https://server.example/api/logout', auth: 'Bearer T2' });
  });

  it('reports the server error and a network failure; a wrong login stores nothing', async () => {
    const storage = memoryStorage();
    const bad = createCloudSave(cfg, storage, fakeFetch({ 'POST /api/login': { status: 401, body: { error: 'bad_login' } } }).fn);
    expect(await bad.login('a', 'b')).toEqual({ ok: false, error: 'bad_login' });
    expect(storage.get(CLOUD_SESSION_KEY)).toBeNull();
    const off = createCloudSave(cfg, storage, fakeFetch({ 'POST /api/login': 'network' }).fn);
    expect(await off.login('a', 'b')).toEqual({ ok: false, error: 'network' });
  });

  it('sync: uploads when this device is newer, downloads when the cloud is newer, does nothing on a tie', async () => {
    const storage = memoryStorage({ [CLOUD_SESSION_KEY]: JSON.stringify({ token: 'T', username: 'Tester' }) });
    const answers = {
      'GET /api/save/meta': { status: 200, body: { revision: 3, version: 32, savedAt: 1000 } },
      'PUT /api/save': { status: 200, body: { revision: 4, version: 32, savedAt: 2000 } },
      'GET /api/save': { status: 200, body: { revision: 3, version: 32, savedAt: 1000, save: { version: 32, savedAt: 1000, state: { cloud: true } } } },
    };
    const f = fakeFetch(answers);
    const c = createCloudSave(cfg, storage, f.fn);
    expect(await c.syncNow(local(2000))).toEqual({ ok: true, action: 'uploaded' });
    expect(f.calls.find((x) => x.method === 'PUT')).toMatchObject({ auth: 'Bearer T', body: local(2000) });
    const down = await c.syncNow(local(500));
    expect(down).toMatchObject({ ok: true, action: 'download', savedAt: 1000 });
    expect(JSON.parse((down as { text: string }).text).state).toEqual({ cloud: true });
    expect(await c.syncNow(local(1000))).toEqual({ ok: true, action: 'unchanged' });
  });

  it('sync with no cloud save uploads; with no local save downloads; the server can still refuse an upload', async () => {
    const storage = memoryStorage({ [CLOUD_SESSION_KEY]: JSON.stringify({ token: 'T', username: 'Tester' }) });
    const none = createCloudSave(cfg, storage, fakeFetch({ 'GET /api/save/meta': { status: 404, body: { error: 'no_save' } }, 'PUT /api/save': { status: 200 } }).fn);
    expect(await none.syncNow(local(10))).toEqual({ ok: true, action: 'uploaded' });
    expect(await none.syncNow(null)).toEqual({ ok: true, action: 'unchanged' });
    const race = createCloudSave(cfg, storage, fakeFetch({ 'GET /api/save/meta': { status: 404 }, 'PUT /api/save': { status: 409, body: { error: 'newer_on_server' } } }).fn);
    expect(await race.syncNow(local(10))).toEqual({ ok: false, error: 'newer_on_server' });
  });

  it('a signed-out sync does not call the server, an expired session is cleared', async () => {
    const storage = memoryStorage();
    const f = fakeFetch({});
    const c = createCloudSave(cfg, storage, f.fn);
    expect(await c.syncNow(local(1))).toEqual({ ok: false, error: 'unauthorized' });
    expect(f.calls).toHaveLength(0);
    storage.set(CLOUD_SESSION_KEY, JSON.stringify({ token: 'old', username: 'Tester' }));
    const expired = createCloudSave(cfg, storage, fakeFetch({ 'GET /api/save/meta': { status: 401, body: { error: 'unauthorized' } } }).fn);
    expect(await expired.syncNow(local(1))).toEqual({ ok: false, error: 'unauthorized' });
    expect(expired.username()).toBeNull();
  });
});
