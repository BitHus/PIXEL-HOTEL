// Visits (PLAN-ONLINE P2): private by default, visit codes, the public list, the read-only room view (leak tests), block and report,
// rate limits and abuse cases. Time is driven by `now`.

import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNewPlayer, toSaveText, type GameState } from '@pixel-hotel/shared';
import { loadConfig } from './config.ts';
import { openDb, type Db } from './db.ts';
import { createApiServer } from './http.ts';
import { RateLimiter } from './rateLimit.ts';
import { CODE_ALPHABET, cleanTitle, listPublic, newVisitCode, normalizeCode, PUBLIC_PAGE_SIZE, setShare } from './rooms.ts';
import { buildRoomView, FALLBACK_NAME } from './roomView.ts';
import { putSave } from './saves.ts';

let now = 1_800_000_000_000;
let db: Db;
let base = '';
let close: () => Promise<void>;

const SECRET_GOLD = 987_654_321;
const SECRET_GEMS = 876_543_219;

/** A created player's state with private things that must never leave: a marked wallet, ledger, materials and stray fields. */
function hostState(name = 'Ada Brewer'): GameState {
  const s = createNewPlayer(undefined, 0);
  const hotel = s.rooms.find((r) => r.kind === 'hotel')!;
  const anyType = s.items.find((i) => i.roomId !== null)!.typeId;
  const state: GameState = {
    ...s,
    playerCreated: true,
    player: { ...s.player, name, wallet: { ...s.player.wallet, gold: SECRET_GOLD, gems: SECRET_GEMS }, materials: { ...s.player.materials, crystal: 7_771_777 } },
    ledger: [...s.ledger, { ...(s.ledger[0] as object), reason: 'SECRET_LEDGER' } as unknown as GameState['ledger'][number]],
    items: [
      ...s.items,
      { uid: 90_001, typeId: anyType, ownerId: s.player.id, roomId: hotel.id, x: 96, y: 160, facing: 'down', onItemUid: null },
      { uid: 90_002, typeId: anyType, ownerId: s.player.id, roomId: null, x: 0, y: 0, facing: 'down', onItemUid: null },
    ],
    rooms: s.rooms.map((r) =>
      r.id === hotel.id
        ? { ...r, floorCells: { '1,1': 'bare' }, blocks: { '2,3': [{ id: 'dirt', hits: 3, hitAt: 4242 }] }, plants: { '4,3': { seed: 'turnip_seed', plantedAt: 10, readyAt: 20 } } }
        : r,
    ) as GameState['rooms'],
  };
  // Stray fields a tampered client could put in its save.
  (state.rooms[0] as unknown as Record<string, unknown>).secretNote = 'SECRET_ROOM';
  (state.items[state.items.length - 2] as unknown as Record<string, unknown>).secretNote = 'SECRET_ITEM';
  (state.look as unknown as Record<string, unknown>).secretNote = 'SECRET_LOOK';
  (state.player as unknown as Record<string, unknown>).secretNote = 'SECRET_PLAYER';
  return state;
}
const hostSave = (savedAt: number, name?: string): string => toSaveText(hostState(name), savedAt);
const roomIdOf = (kind: string): number => hostState().rooms.find((r) => r.kind === kind)!.id;

const ALLOWED_KEYS = new Set([
  'code', 'title', 'view', 'v', 'owner', 'name', 'look', 'room', 'items', 'stars', 'savedAt',
  'skin', 'hair', 'hairStyle', 'top', 'shirt', 'bottoms', 'legs', 'shoes', 'hat', 'outer',
  'kind', 'level', 'shape', 'w', 'h', 'floorStyle', 'floorCells', 'wallStyle', 'blocks', 'plants',
  'uid', 'typeId', 'x', 'y', 'facing', 'onItemUid', 'on', 'seed', 'plantedAt', 'readyAt', 'with',
]);
const CELL = /^-?\d+,-?\d+$/;
function strayKeys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) strayKeys(x, out);
  else if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) {
      if (!ALLOWED_KEYS.has(k) && !CELL.test(k)) out.push(k);
      strayKeys(x, out);
    }
  }
  return out;
}
function expectNoLeak(payload: unknown): void {
  const text = JSON.stringify(payload);
  for (const secret of ['SECRET', String(SECRET_GOLD), String(SECRET_GEMS), '7771777', 'wallet', 'gold', 'gems', 'ledger', 'materials', 'hotbar', 'bag', 'tavern', 'ownerId', 'pw_hash', 'account', 'hitAt']) {
    expect(text, `leaks ${secret}`).not.toContain(secret);
  }
  expect(strayKeys(payload)).toEqual([]);
}

async function start(): Promise<void> {
  db = openDb(':memory:');
  const config = loadConfig({ PB_BCRYPT_COST: '4', PB_IP_KEY: 'test-key', PB_ORIGINS: 'https://pocketbarrel.com' });
  const server = createApiServer({ config, db, now: () => now });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise<void>((r) => server.close(() => r()));
}

const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });
const get = (token: string, path: string) => fetch(base + path, { headers: auth(token) });
const send = (method: string, token: string, path: string, body: unknown) =>
  fetch(base + path, { method, headers: auth(token), body: typeof body === 'string' ? body : JSON.stringify(body) });
const json = async <T>(r: Response): Promise<T> => (await r.json()) as T;

async function register(name: string): Promise<string> {
  const r = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: name, password: 'correct horse', age13: true }) });
  expect(r.status).toBe(201);
  return (await json<{ token: string }>(r)).token;
}
/** A registered host with an uploaded save. */
async function host(name = 'Host', displayName?: string): Promise<string> {
  const token = await register(name);
  expect((await send('PUT', token, '/api/save', hostSave(now, displayName))).status).toBe(200);
  return token;
}
interface Share { roomId: number; kind: string; visibility: string; code: string | null; title: string | null }
async function share(token: string, body: Record<string, unknown>): Promise<Share> {
  const r = await send('PUT', token, '/api/rooms/share', body);
  expect(r.status).toBe(200);
  return json<Share>(r);
}
/** Moves the clock past every per-minute and per-10-second window. */
const tick = (ms = 61_000): void => {
  now += ms;
};

beforeEach(async () => {
  now = 1_800_000_000_000;
  await start();
});
afterEach(async () => {
  await close();
  db.close();
});

describe('visit codes and titles (pure)', () => {
  it('a code is 6 characters from the 31-letter alphabet (no 0 O 1 I L), from the rng passed in', () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    let n = 0;
    expect(newVisitCode(() => n++)).toBe('ABCDEF');
    for (let i = 0; i < 200; i++) expect(newVisitCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
  it('normalizes typed codes and refuses everything else', () => {
    expect(normalizeCode('k7qx2m')).toBe('K7QX2M');
    expect(normalizeCode(' K7Q-X2M ')).toBe('K7QX2M');
    for (const bad of ['', 'K7QX2', 'K7QX2MM', 'K7QX2O', 'K7QX20', 'K7QX2!', "' OR 1=1", 'x'.repeat(5000), 42, null, undefined, {}]) expect(normalizeCode(bad)).toBeNull();
  });
  it('titles: at most 24 letters, digits, spaces and a few marks', () => {
    expect(cleanTitle("  Ada's   cosy room! ")).toBe("Ada's cosy room!");
    for (const bad of ['', '   ', 'x'.repeat(25), '<script>', 'http://x.y', 7, null]) expect(cleanTitle(bad)).toBeNull();
  });
  it('the limiter can tell it is full without counting a hit', () => {
    const l = new RateLimiter(1, 1000);
    expect(l.blocked('a', 0)).toBe(false);
    l.take('a', 0);
    expect(l.blocked('a', 10)).toBe(true);
    expect(l.blocked('a', 1000)).toBe(false);
  });
});

describe('the room view (pure, leak tests)', () => {
  it('holds the floor, walls, furniture of that room, blocks, plants, look and display name, and nothing else', () => {
    const state = hostState();
    const hotel = state.rooms.find((r) => r.kind === 'hotel')!;
    const view = buildRoomView(state, hotel.id, 123)!;
    expect(view.owner.name).toBe('Ada Brewer');
    expect(view.owner.look.hairStyle).toBe(state.look.hairStyle);
    expect(view.room).toMatchObject({ kind: 'hotel', shape: hotel.shape, w: hotel.w, h: hotel.h, floorStyle: hotel.floorStyle, wallStyle: hotel.wallStyle });
    expect(view.room.floorCells).toEqual({ '1,1': 'bare' });
    expect(view.room.blocks).toEqual({ '2,3': ['dirt'] });
    expect(view.room.plants).toEqual({ '4,3': { seed: 'turnip_seed', plantedAt: 10, readyAt: 20 } });
    expect(view.items.map((i) => i.uid)).toEqual([90_001]); // not the shop's furniture, not the inventory
    expect(view.stars).toBeGreaterThanOrEqual(1);
    expect(view.savedAt).toBe(123);
    expectNoLeak(view);
  });
  it('the tavern gives no view (owner 19 Nov: online is only the hotel room, garden and public spaces)', () => {
    const state = hostState();
    expect(buildRoomView(state, state.rooms.find((r) => r.kind === 'shop')!.id, 1)).toBeNull();
  });
  it('farm, lakeside and unknown rooms give no view', () => {
    const state = hostState();
    expect(buildRoomView(state, state.rooms.find((r) => r.kind === 'farm')!.id, 1)).toBeNull();
    expect(buildRoomView(state, state.rooms.find((r) => r.kind === 'lakeside')!.id, 1)).toBeNull();
    expect(buildRoomView(state, 999_999, 1)).toBeNull();
  });
  it('a name or id with characters that are not allowed never reaches a visitor', () => {
    const state = hostState('<img src=x onerror=1>');
    (state.look as { hairStyle: string }).hairStyle = '"><script>';
    const hotel = state.rooms.find((r) => r.kind === 'hotel')!;
    (hotel.floorCells as Record<string, string>)['__proto__x'] = 'bare';
    (hotel.floorCells as Record<string, string>)['2,2'] = '<b>';
    const view = buildRoomView(state, hotel.id, 1)!;
    expect(view.owner.name).toBe(FALLBACK_NAME);
    expect(view.owner.look.hairStyle).toBe('');
    expect(view.room.floorCells).toEqual({ '1,1': 'bare' });
    expect(JSON.stringify(view)).not.toMatch(/[<>]/);
  });
});

describe('sharing a room', () => {
  it('every visit endpoint needs a session', async () => {
    for (const [method, path] of [['GET', '/api/rooms/mine'], ['PUT', '/api/rooms/share'], ['GET', '/api/rooms/public'], ['POST', '/api/rooms/block'], ['GET', '/api/visit/K7QX2M'], ['POST', '/api/visit/report']] as const) {
      const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
      expect(r.status, path).toBe(401);
    }
  });
  it('rooms are private by default: no code, not on the board; only the hotel room can be shared (never the tavern)', async () => {
    const a = await host();
    const mine = await json<{ rooms: Share[] }>(await get(a, '/api/rooms/mine'));
    expect(mine.rooms.map((r) => r.kind).sort()).toEqual(['hotel']);
    for (const r of mine.rooms) expect(r).toMatchObject({ visibility: 'private', code: null });
    expect((await json<{ rooms: unknown[] }>(await get(a, '/api/rooms/public'))).rooms).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM room_shares').get()).toEqual({ n: 0 });
  });
  it('without a save there is nothing to list or share', async () => {
    const a = await register('NoSave');
    expect((await json<{ rooms: unknown[] }>(await get(a, '/api/rooms/mine'))).rooms).toEqual([]);
    const r = await send('PUT', a, '/api/rooms/share', { roomId: 1, visibility: 'code' });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'no_save' });
  });
  it('a shared room gets a code; a visitor with the code sees the room view and nothing private', async () => {
    const a = await host();
    const b = await register('Visitor');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'code', title: 'Cosy corner' });
    expect(s.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    const r = await get(b, `/api/visit/${s.code!.toLowerCase()}`);
    expect(r.status).toBe(200);
    const body = await json<{ code: string; title: string; view: { owner: { name: string }; items: { uid: number }[]; room: { kind: string } } }>(r);
    expect(body).toMatchObject({ code: s.code, title: 'Cosy corner', view: { owner: { name: 'Ada Brewer' }, room: { kind: 'hotel' } } });
    expect(body.view.items.map((i) => i.uid)).toEqual([90_001]);
    expectNoLeak(body);
    // The owner can open their own code; code-only rooms are not on the board; the other room stays private.
    expect((await get(a, `/api/visit/${s.code}`)).status).toBe(200);
    expect((await json<{ rooms: unknown[] }>(await get(b, '/api/rooms/public'))).rooms).toEqual([]);
    const mine = await json<{ rooms: Share[] }>(await get(a, '/api/rooms/mine'));
    expect(mine.rooms.find((x) => x.kind === 'shop')).toBeUndefined();
  });
  it('a client cannot plant a view, a name or a code: the body is only roomId, visibility, title, rotate', async () => {
    const a = await host();
    const b = await register('Visitor');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'code', code: 'AAAAAA', view: { owner: { name: 'Fake' } }, owner_name: 'Fake', stars: 5, account_id: 1 });
    expect(s.code).not.toBe('AAAAAA');
    const body = await json<{ view: { owner: { name: string } } }>(await get(b, `/api/visit/${s.code}`));
    expect(body.view.owner.name).toBe('Ada Brewer');
    expectNoLeak(body);
  });
  it('refuses bad share requests', async () => {
    const a = await host();
    const hotel = roomIdOf('hotel');
    const bad: [unknown, number, string][] = [
      [{ roomId: '1', visibility: 'code' }, 400, 'bad_request'],
      [{ roomId: 1.5, visibility: 'code' }, 400, 'bad_request'],
      [{ roomId: -1, visibility: 'code' }, 400, 'bad_request'],
      [{ roomId: hotel }, 400, 'bad_request'],
      [{ roomId: hotel, visibility: 'everyone' }, 400, 'bad_request'],
      [{ roomId: hotel, visibility: 'code', rotate: 'yes' }, 400, 'bad_request'],
      [{ roomId: hotel, visibility: 'code', title: '<script>alert(1)</script>' }, 400, 'bad_title'],
      [{ roomId: hotel, visibility: 'code', title: 'x'.repeat(25) }, 400, 'bad_title'],
      [{ roomId: hotel, visibility: 'code', title: 42 }, 400, 'bad_title'],
      [{ roomId: 999_999, visibility: 'code' }, 404, 'no_room'],
      [{ roomId: roomIdOf('farm'), visibility: 'public' }, 400, 'not_visitable'],
      [{ roomId: roomIdOf('lakeside'), visibility: 'code' }, 400, 'not_visitable'],
      ['[1,2]', 400, 'bad_json'],
      ['{not json', 400, 'bad_json'],
    ];
    for (const [body, status, error] of bad) {
      const r = await send('PUT', a, '/api/rooms/share', body);
      expect(r.status, JSON.stringify(body)).toBe(status);
      expect(await r.json()).toEqual({ error });
      tick(7_000);
    }
    expect((await send('PUT', a, '/api/rooms/share', JSON.stringify({ roomId: hotel, visibility: 'code', title: 'x'.repeat(5000) }))).status).toBe(413);
    expect(db.prepare('SELECT COUNT(*) AS n FROM room_shares').get()).toEqual({ n: 0 });
  });
  it('making a room private deletes the code; rotate gives a new one and the old stops working', async () => {
    const a = await host();
    const b = await register('Visitor');
    const hotel = roomIdOf('hotel');
    const first = await share(a, { roomId: hotel, visibility: 'code' });
    const kept = await share(a, { roomId: hotel, visibility: 'code', title: 'Kept' });
    expect(kept.code).toBe(first.code);
    const rotated = await share(a, { roomId: hotel, visibility: 'code', rotate: true });
    expect(rotated.code).not.toBe(first.code);
    expect(rotated.title).toBe('Kept'); // an absent title keeps it
    expect((await get(b, `/api/visit/${first.code}`)).status).toBe(404);
    expect((await get(b, `/api/visit/${rotated.code}`)).status).toBe(200);
    expect(await share(a, { roomId: hotel, visibility: 'private' })).toMatchObject({ visibility: 'private', code: null });
    const gone = await get(b, `/api/visit/${rotated.code}`);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'no_room' });
    expect((await get(a, `/api/visit/${rotated.code}`)).status).toBe(404);
  });
  it('the view follows the newest accepted save; a room that left the save stops being shared', async () => {
    const a = await host();
    const b = await register('Visitor');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'public' });
    tick();
    const next = hostState('Bo');
    next.items = next.items.filter((i) => i.uid !== 90_001);
    expect((await send('PUT', a, '/api/save', toSaveText(next, now))).status).toBe(200);
    const body = await json<{ view: { owner: { name: string }; items: unknown[]; savedAt: number } }>(await get(b, `/api/visit/${s.code}`));
    expect(body.view).toMatchObject({ owner: { name: 'Bo' }, items: [], savedAt: now });
    expect((await json<{ rooms: { owner: string }[] }>(await get(b, '/api/rooms/public'))).rooms[0]!.owner).toBe('Bo');
    tick();
    const moved = hostState();
    moved.rooms = moved.rooms.map((r) => (r.kind === 'hotel' ? { ...r, kind: 'farm' as const } : r));
    expect((await send('PUT', a, '/api/save', toSaveText(moved, now))).status).toBe(200);
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(404);
  });
});

describe('the public list', () => {
  it('lists only rooms set public, with title, owner display name, kind, stars and the code; nothing private', async () => {
    const a = await host('HostA', 'Ada');
    const b = await host('HostB', 'Bram');
    const c = await register('Visitor');
    const pub = await share(a, { roomId: roomIdOf('hotel'), visibility: 'public', title: 'The Barrel' });
    await share(b, { roomId: roomIdOf('hotel'), visibility: 'code' });
    const list = await json<{ rooms: Record<string, unknown>[]; page: number; more: boolean }>(await get(c, '/api/rooms/public'));
    expect(list).toMatchObject({ page: 0, more: false });
    expect(list.rooms).toHaveLength(1);
    expect(list.rooms[0]).toMatchObject({ code: pub.code, title: 'The Barrel', owner: 'Ada', kind: 'hotel' });
    expect(Object.keys(list.rooms[0]!).sort()).toEqual(['code', 'kind', 'owner', 'stars', 'title', 'updatedAt']);
    expect(JSON.stringify(list)).not.toContain('HostA'); // the login name is not the display name
    expect((await get(c, `/api/visit/${pub.code}`)).status).toBe(200);
  });
  it('going from public back to code leaves the board and changes the code', async () => {
    const a = await host();
    const c = await register('Visitor');
    const shop = roomIdOf('hotel');
    const pub = await share(a, { roomId: shop, visibility: 'public' });
    const back = await share(a, { roomId: shop, visibility: 'code' });
    expect(back.code).not.toBe(pub.code);
    expect((await json<{ rooms: unknown[] }>(await get(c, '/api/rooms/public'))).rooms).toEqual([]);
    expect((await get(c, `/api/visit/${pub.code}`)).status).toBe(404);
  });
  it('pages of 20, newest first or by stars; bad query values are refused', async () => {
    const viewer = await register('Visitor');
    for (let i = 0; i < PUBLIC_PAGE_SIZE + 3; i++) {
      const id = Number(db.prepare("INSERT INTO accounts (username, pw_hash, created_at, age_ok, age_ok_at) VALUES (?, 'x', 0, 1, 0)").run(`Bulk${i}`).lastInsertRowid);
      expect(putSave(db, id, hostSave(now), now, 10).ok).toBe(true);
      expect(setShare(db, id, { roomId: roomIdOf('hotel'), visibility: 'public' }, now + i).ok).toBe(true);
    }
    const p0 = await json<{ rooms: { updatedAt: number }[]; more: boolean }>(await get(viewer, '/api/rooms/public?page=0'));
    expect(p0.rooms).toHaveLength(PUBLIC_PAGE_SIZE);
    expect(p0.more).toBe(true);
    expect(p0.rooms[0]!.updatedAt).toBeGreaterThan(p0.rooms[1]!.updatedAt);
    const p1 = await json<{ rooms: unknown[]; more: boolean; page: number }>(await get(viewer, '/api/rooms/public?page=1&sort=stars'));
    expect(p1).toMatchObject({ page: 1, more: false });
    expect(p1.rooms).toHaveLength(3);
    for (const q of ['page=-1', 'page=abc', 'page=99999', 'page=1e3', 'sort=gold', 'page=51']) expect((await get(viewer, `/api/rooms/public?${q}`)).status, q).toBe(400);
    expect(listPublic(db, 0, 50, 'new').rooms).toEqual([]);
  });
});

describe('abuse cases', () => {
  it('unknown, malformed and oversize codes all give the same 404', async () => {
    const a = await host();
    await share(a, { roomId: roomIdOf('hotel'), visibility: 'code' });
    const b = await register('Visitor');
    for (const c of ['ZZZZZZ', 'abc', '%27%20OR%201=1', '..%2F..%2Fsave', '%E0%A4%A', 'A'.repeat(3000), '']) {
      const r = await get(b, `/api/visit/${c}`);
      expect(r.status, c.slice(0, 20)).toBe(404);
      expect(await r.json()).toEqual({ error: 'no_room' });
    }
  });
  it('guessing is throttled: after 10 wrong codes in a minute even a good code waits; a good code never counts', async () => {
    const a = await host();
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'code' });
    const b = await register('Visitor');
    for (let i = 0; i < 12; i++) expect((await get(b, `/api/visit/${s.code}`)).status).toBe(200);
    for (let i = 0; i < 10; i++) expect((await get(b, '/api/visit/ZZZZZZ')).status).toBe(404);
    expect((await get(b, '/api/visit/ZZZZZZ')).status).toBe(429);
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(429);
    tick();
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(200);
  });
  it('a deleted account takes its rooms, codes and board entries with it', async () => {
    const a = await host('Leaver');
    const b = await register('Visitor');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'public' });
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(200);
    db.prepare("DELETE FROM accounts WHERE username = 'Leaver'").run();
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(404);
    expect((await json<{ rooms: unknown[] }>(await get(b, '/api/rooms/public'))).rooms).toEqual([]);
    expect((await get(a, '/api/rooms/mine')).status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS n FROM room_shares').get()).toEqual({ n: 0 });
  });
  it('a blocked visitor gets the same 404 and does not see the room on the board; unblocking restores it', async () => {
    const a = await host();
    const b = await register('Visitor');
    const c = await register('Other');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'public' });
    expect((await send('POST', a, '/api/rooms/block', { username: 'visitor', blocked: true })).status).toBe(200);
    const r = await get(b, `/api/visit/${s.code}`);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'no_room' });
    expect((await json<{ rooms: unknown[] }>(await get(b, '/api/rooms/public'))).rooms).toEqual([]);
    expect((await get(c, `/api/visit/${s.code}`)).status).toBe(200);
    expect((await json<{ rooms: unknown[] }>(await get(c, '/api/rooms/public'))).rooms).toHaveLength(1);
    // An unknown name looks the same as a known one; bad input is refused; blocking yourself does nothing.
    expect((await send('POST', a, '/api/rooms/block', { username: 'Nobody', blocked: true })).status).toBe(200);
    expect((await send('POST', a, '/api/rooms/block', { username: 'Host', blocked: true })).status).toBe(200);
    expect((await get(a, `/api/visit/${s.code}`)).status).toBe(200);
    expect((await send('POST', a, '/api/rooms/block', { username: 'Visitor' })).status).toBe(400);
    expect((await send('POST', a, '/api/rooms/block', { username: 7, blocked: true })).status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS n FROM visit_blocks').get()).toEqual({ n: 1 });
    expect((await send('POST', a, '/api/rooms/block', { username: 'Visitor', blocked: false })).status).toBe(200);
    expect((await get(b, `/api/visit/${s.code}`)).status).toBe(200);
  });
  it('reports are stored with the session account (never a sent id), validated and limited to 5 per minute', async () => {
    const a = await host();
    const b = await register('Visitor');
    const s = await share(a, { roomId: roomIdOf('hotel'), visibility: 'code' });
    expect((await send('POST', b, '/api/visit/report', { code: s.code, kind: 'room', note: ' rude\u0000 sign ', reporter_id: 999, target_id: 999 })).status).toBe(200);
    const row = db.prepare('SELECT reporter_id, target_id, room_id, kind, note, status FROM reports').get() as Record<string, unknown>;
    const idOf = (n: string) => (db.prepare('SELECT id FROM accounts WHERE username = ?').get(n) as { id: number }).id;
    expect(row).toEqual({ reporter_id: idOf('Visitor'), target_id: idOf('Host'), room_id: roomIdOf('hotel'), kind: 'room', note: 'rude  sign', status: 'open' });
    const bad: [unknown, number][] = [
      [{ code: s.code, kind: 'spam' }, 400],
      [{ code: s.code }, 400],
      [{ code: 'nope', kind: 'room' }, 400],
      [{ code: s.code, kind: 'room', note: 'x'.repeat(121) }, 400],
      [{ code: 'ZZZZZZ', kind: 'room' }, 404],
    ];
    for (const [body, status] of bad) {
      tick();
      expect((await send('POST', b, '/api/visit/report', body)).status, JSON.stringify(body)).toBe(status);
    }
    tick();
    expect((await send('POST', a, '/api/visit/report', { code: s.code, kind: 'room' })).status).toBe(404); // not your own room
    expect((await send('POST', b, '/api/visit/report', 'x'.repeat(5000))).status).toBe(413);
    tick();
    for (let i = 0; i < 5; i++) expect((await send('POST', b, '/api/visit/report', { code: s.code, kind: 'other' })).status).toBe(200);
    expect((await send('POST', b, '/api/visit/report', { code: s.code, kind: 'other' })).status).toBe(429);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reports').get()).toEqual({ n: 6 });
  });
  it('share changes are limited to 10 per minute per account', async () => {
    const a = await host();
    const hotel = roomIdOf('hotel');
    for (let i = 0; i < 10; i++) await share(a, { roomId: hotel, visibility: i % 2 ? 'private' : 'code' });
    expect((await send('PUT', a, '/api/rooms/share', { roomId: hotel, visibility: 'code' })).status).toBe(429);
  });
  it('an old database gets the visit tables by migration 2', () => {
    expect((db.prepare('SELECT v FROM schema_version').get() as { v: number }).v).toBeGreaterThanOrEqual(2); // later migrations (3: bans) come on top
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    for (const t of ['room_shares', 'visit_blocks', 'reports']) expect(tables).toContain(t);
  });
});

describe('scope (owner 19 Nov): online is only the hotel room; tavern, kitchen, cellar, farm, mine, dungeon are refused', () => {
  /** The host's state with one extra room of `kind` (a copy of the hotel room with a new id). */
  function withRoom(kind: string, id: number): GameState {
    const s = hostState();
    const hotel = s.rooms.find((r) => r.kind === 'hotel')!;
    return { ...s, rooms: [...s.rooms, { ...hotel, id, kind } as unknown as GameState['rooms'][number]] };
  }
  it('the share endpoint refuses every room kind but the hotel room, by Room.kind', async () => {
    const a = await host();
    for (const kind of ['shop', 'farm', 'lakeside']) {
      const r = await send('PUT', a, '/api/rooms/share', { roomId: roomIdOf(kind), visibility: 'public' });
      expect(r.status, kind).toBe(400);
      expect(await r.json()).toEqual({ error: 'not_visitable' });
      tick(7_000);
    }
    const accepted: string[] = [];
    for (const [i, kind] of ['cellar', 'kitchen', 'mine', 'dungeon', 'tavern'].entries()) {
      tick();
      const up = await send('PUT', a, '/api/save', toSaveText(withRoom(kind, 500 + i), now));
      if (up.status !== 200) continue; // the save check already refuses an unknown kind: just as good
      accepted.push(kind);
      for (const visibility of ['code', 'public']) {
        const r = await send('PUT', a, '/api/rooms/share', { roomId: 500 + i, visibility });
        expect(r.status, `${kind} ${visibility}`).toBe(400);
        expect(await r.json()).toEqual({ error: 'not_visitable' });
        tick(7_000);
      }
      expect((await json<{ rooms: Share[] }>(await get(a, '/api/rooms/mine'))).rooms.map((r) => r.kind)).toEqual(['hotel']);
    }
    expect(accepted).toContain('cellar'); // the cellar is a real room of SAVE 42 and reaches the share check (a kitchen room is refused by the save check: it is the tavern annex since SAVE 39)
    expect(db.prepare('SELECT COUNT(*) AS n FROM room_shares').get()).toEqual({ n: 0 });
  });
  it('a stored share of another kind (an old row) is never served, listed or reportable', async () => {
    const a = await host();
    const b = await register('Visitor');
    const ownerId = (db.prepare("SELECT id FROM accounts WHERE username = 'Host'").get() as { id: number }).id;
    const tavern = hostState().rooms.find((r) => r.kind === 'shop')!;
    const fakeView = { v: 1, owner: { name: 'Ada', look: hostState().look }, room: { kind: 'shop', level: 1, shape: tavern.shape, w: tavern.w, h: tavern.h, floorStyle: 'bare', floorCells: {}, wallStyle: 'bare', blocks: {}, plants: {} }, items: [], stars: 3, savedAt: now };
    db.prepare(
      `INSERT INTO room_shares (account_id, room_id, visibility, code, title, kind, owner_name, stars, view, shared_at, updated_at) VALUES (?, ?, 'public', 'TAVRNX', 'Old tavern', 'shop', 'Ada', 3, ?, ?, ?)`,
    ).run(ownerId, tavern.id, gzipSync(Buffer.from(JSON.stringify(fakeView))), now, now);
    // A hotel row whose stored view claims another kind is refused as well.
    db.prepare(
      `INSERT INTO room_shares (account_id, room_id, visibility, code, title, kind, owner_name, stars, view, shared_at, updated_at) VALUES (?, 777, 'code', 'HTMXYZ', NULL, 'hotel', 'Ada', 3, ?, ?, ?)`,
    ).run(ownerId, gzipSync(Buffer.from(JSON.stringify(fakeView))), now, now);
    for (const code of ['TAVRNX', 'HTMXYZ']) {
      const r = await get(b, `/api/visit/${code}`);
      expect(r.status, code).toBe(404);
      expect(await r.json()).toEqual({ error: 'no_room' });
    }
    expect((await json<{ rooms: unknown[] }>(await get(b, '/api/rooms/public'))).rooms).toEqual([]);
    expect((await send('POST', b, '/api/visit/report', { code: 'TAVRNX', kind: 'room' })).status).toBe(404);
    // The next accepted save drops the stale rows (refreshShares rebuilds only visitable rooms).
    tick();
    expect((await send('PUT', a, '/api/save', hostSave(now))).status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM room_shares').get()).toEqual({ n: 0 });
  });
});
