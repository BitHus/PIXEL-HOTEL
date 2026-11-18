import { ROOM_VIEW_VERSION } from '@pixel-hotel/shared';
import { describe, expect, it } from 'vitest';
import { createCloudApi } from './cloudApi.ts';
import { CLOUD_SESSION_KEY } from './cloudSave.ts';
import { memoryStorage } from './saveStorage.ts';

type Call = { url: string; method: string; auth: string | null; body: string | null };

function fakeFetch(answers: Record<string, { status: number; body?: unknown } | 'network'>): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method, auth: headers.authorization ?? null, body: typeof init?.body === 'string' ? init.body : null });
    const a = answers[`${method} ${new URL(url).pathname}`];
    if (a === 'network' || a === undefined) throw new TypeError('offline');
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const cfg = { baseUrl: 'https://server.example' };
const signedIn = () => {
  const s = memoryStorage();
  s.set(CLOUD_SESSION_KEY, JSON.stringify({ token: 'tok', username: 'Ann' }));
  return s;
};
const view = {
  code: 'K7QX2M',
  title: null,
  view: { v: ROOM_VIEW_VERSION, owner: { name: 'Bo', look: {} }, room: { kind: 'hotel' }, items: [], stars: 2, savedAt: 1 },
};

describe('cloudApi (visits, read only)', () => {
  it('without a session nothing is sent', async () => {
    const f = fakeFetch({});
    const api = createCloudApi(cfg, memoryStorage(), f.fn);
    expect(api.signedIn()).toBe(false);
    expect(await api.visit('K7QX2M')).toEqual({ ok: false, error: 'unauthorized' });
    expect(f.calls).toHaveLength(0);
  });

  it('visit: GET with the bearer token, the answer is shape-checked', async () => {
    const f = fakeFetch({ 'GET /api/visit/K7QX2M': { status: 200, body: view } });
    const api = createCloudApi(cfg, signedIn(), f.fn);
    const r = await api.visit('K7QX2M');
    expect(r.ok && r.value.view.owner.name).toBe('Bo');
    expect(f.calls[0]).toMatchObject({ method: 'GET', auth: 'Bearer tok', body: null });
    const bad = fakeFetch({ 'GET /api/visit/K7QX2M': { status: 200, body: { code: 'K7QX2M', view: { v: 99 } } } });
    expect(await createCloudApi(cfg, signedIn(), bad.fn).visit('K7QX2M')).toEqual({ ok: false, error: 'bad_answer' });
  });

  it('server errors come back as their code; a 401 forgets the session; offline = network', async () => {
    const s = signedIn();
    const f = fakeFetch({ 'GET /api/visit/AAAAAA': { status: 404, body: { error: 'no_room' } }, 'GET /api/rooms/mine': { status: 401, body: { error: 'unauthorized' } } });
    const api = createCloudApi(cfg, s, f.fn);
    expect(await api.visit('AAAAAA')).toEqual({ ok: false, error: 'no_room' });
    expect(await api.myRooms()).toEqual({ ok: false, error: 'unauthorized' });
    expect(api.signedIn()).toBe(false);
    expect(await createCloudApi(cfg, signedIn(), fakeFetch({}).fn).publicRooms(0, 'new')).toEqual({ ok: false, error: 'network' });
  });

  it('share, rooms, board, report and block send the protocol shapes', async () => {
    const row = { roomId: 1, kind: 'hotel', visibility: 'code', code: 'K7QX2M', title: null };
    const f = fakeFetch({
      'PUT /api/rooms/share': { status: 200, body: row },
      'GET /api/rooms/mine': { status: 200, body: { rooms: [row] } },
      'GET /api/rooms/public': { status: 200, body: { rooms: [], page: 2, more: false } },
      'POST /api/visit/report': { status: 200, body: { ok: true } },
      'POST /api/rooms/block': { status: 200, body: { ok: true } },
    });
    const api = createCloudApi(cfg, signedIn(), f.fn);
    expect(await api.share({ roomId: 1, visibility: 'code' })).toEqual({ ok: true, value: row });
    expect(await api.myRooms()).toEqual({ ok: true, value: [row] });
    expect((await api.publicRooms(2.7, 'stars')).ok).toBe(true);
    expect(f.calls[2]?.url).toBe('https://server.example/api/rooms/public?page=2&sort=stars');
    expect(await api.report({ code: 'K7QX2M', kind: 'room' })).toEqual({ ok: true, value: true });
    expect(await api.block({ username: 'Cy', blocked: true })).toEqual({ ok: true, value: true });
    expect(JSON.parse(f.calls[0]?.body ?? '')).toEqual({ roomId: 1, visibility: 'code' });
  });
});
