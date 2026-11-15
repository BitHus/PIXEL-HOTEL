import { describe, expect, it } from 'vitest';
import { readSave, saveKey, toSaveText } from './save.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { SAVE_VERSION } from './config.ts';
import { canPlace, footprintRect, getFurnitureType, isOnGrid } from './furniture.ts';
import { createRoom } from './room.ts';
import type { FurnitureItem } from './types.ts';

const state = applyChange(createNewPlayer(undefined, 1), { reason: 'debug', addFurniture: ['chair', 'rug'] }, 2)!;

describe('save files', () => {
  it('saving then loading gives an identical state', () => {
    const loaded = readSave(toSaveText(state, 3));
    expect(loaded).toEqual({ ok: true, state, version: SAVE_VERSION, migrated: false, returnedToBag: 0 });
  });
  it('uses a versioned key', () => {
    expect(saveKey()).toBe(`pixel-hotel.save.v${SAVE_VERSION}`);
  });
  it('refuses broken, foreign, newer and unmigratable older files', () => {
    expect(readSave('{nope')).toEqual({ ok: false, problem: 'bad_json' });
    expect(readSave('{"hello":1}')).toEqual({ ok: false, problem: 'not_a_save' });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION + 1, state }))).toMatchObject({ ok: false, problem: 'too_new' });
    expect(readSave(JSON.stringify({ version: 0, state }))).toMatchObject({ ok: false, problem: 'too_old' });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION, state: { ...state, hotbar: [] } }))).toMatchObject({
      ok: false,
      problem: 'invalid',
    });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION, state: { ...state, bag: null } }))).toMatchObject({ problem: 'invalid' });
  });
  it('migrates a version 1 save (no bag layout) to an empty layout that arrangeState fills', () => {
    const { bag: _bag, shop: _shop, hintsDone: _h, ...v1 } = state;
    const r = readSave(JSON.stringify({ version: 1, savedAt: 0, state: v1 }));
    expect(r).toMatchObject({ ok: true, version: 1, migrated: true });
    if (!r.ok) return;
    expect(r.state.bag.furniture.every((s) => s === null)).toBe(true);
    const arranged = arrangeState(r.state);
    expect(arranged.bag.furniture.slice(0, 2)).toEqual(['chair', 'rug']);
    expect(arranged.bag.materials.slice(0, 2)).toEqual(['wood', 'cloth']);
  });

  it('migrates a version 2 save: an empty shop, no hints done, and the counter and stall_table in the shop', () => {
    const { shop: _shop, hintsDone: _h, ...rest } = state;
    const v2 = { ...rest, items: rest.items.filter((i) => i.roomId === null) };
    const r = readSave(JSON.stringify({ version: 2, savedAt: 0, state: v2 }));
    expect(r).toMatchObject({ ok: true, version: 2, migrated: true });
    if (!r.ok) return;
    expect(r.state.hintsDone).toBe(0);
    expect(r.state.shop.slots).toEqual([]);
    const inShop = r.state.items.filter((i) => i.roomId === r.state.player.shopRoomId).map((i) => i.typeId);
    expect(inShop.sort()).toEqual(['counter', 'stall_table']);
    expect(new Set(r.state.items.map((i) => i.uid)).size).toBe(r.state.items.length);
  });

  it('migrates a version 3 save: a counter against the back wall moves out so the player fits behind it', () => {
    const v3 = { ...state, items: state.items.map((i) => (i.typeId === 'counter' ? { ...i, x: 176, y: 40 } : i)) };
    const r = readSave(JSON.stringify({ version: 3, savedAt: 0, state: v3 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.items.find((i) => i.typeId === 'counter')).toMatchObject({ x: 176, y: 96 }); // on the cell grid (step BG1)
  });

  it('migrates a version 4 save: square rooms, the old look as clothing, and no character creation', () => {
    const { playerCreated: _p, farm: _f, lakeside: _l, ...rest } = state;
    const v4 = {
      ...rest,
      rooms: rest.rooms.filter((r) => r.kind !== 'farm' && r.kind !== 'lakeside').map(({ shape: _s, ...r }) => r),
      look: { skin: 30, hair: 5, hairStyle: 0, shirt: 7, legs: 23, shoes: 6 },
      player: (({ unlockedClothing: _u, lakesideRoomId: _lid, biggest: _b, ...p }) => p)(rest.player),
    };
    const r = readSave(JSON.stringify({ version: 4, savedAt: 0, state: v4 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.rooms.map((x) => x.shape)).toEqual(['square', 'square_shop', 'farm', 'lakeside']);
    expect(r.state.look).toEqual({ skin: 30, hair: 5, hairStyle: 'short', top: 'long_sleeve', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 });
    expect(r.state.player.unlockedClothing).toEqual([]);
    expect(r.state.playerCreated).toBe(true);
  });

  it('migrates a version 6 save (step 9b): a level 1 farm with empty plots, and the run gets a lunch box', () => {
    const { farm: _f, lakeside: _l, ...rest } = state;
    const v6 = {
      ...rest,
      rooms: rest.rooms.filter((r) => r.kind !== 'farm' && r.kind !== 'lakeside'),
      player: (({ farmRoomId: _id, lakesideRoomId: _lid, biggest: _b, ...p }) => p)(rest.player),
      run: { map: {}, enemies: [], player: { hp: 5, potions: 1 } },
    };
    const r = readSave(JSON.stringify({ version: 6, savedAt: 0, state: v6 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    const farm = r.state.rooms.find((x) => x.kind === 'farm');
    expect(farm).toMatchObject({ id: 3, level: 1, shape: 'farm', floorStyle: 'grass', wallStyle: 'hedge' });
    expect(r.state.player.farmRoomId).toBe(3);
    expect(r.state.farm).toEqual({ roomId: 3, plots: Array.from({ length: 6 }, () => ({ crop: null, plantedAt: 0 })) });
    expect(r.state.run?.player).toMatchObject({ hp: 5, potions: 1, food: [], buffs: [], attackCooldownMs: 350 });
  });

  it('migrates a version 7 save (step 9c): no mine visits, a saved run becomes a crypt run, gear ids stay', () => {
    const { mineVisits: _m, ...player } = state.player;
    const v7 = { ...state, player: { ...player, gear: ['iron_sword', 'leather_armor'] }, run: { map: {}, enemies: [], player: { hp: 5 } } };
    const r = readSave(JSON.stringify({ version: 7, savedAt: 0, state: v7 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.player.mineVisits).toBe(0);
    expect(r.state.player.gear).toEqual(['iron_sword', 'leather_armor']);
    expect(r.state.run).toMatchObject({ place: 'crypt', rocks: [], lanternEndsAt: null, player: { hp: 5, hitsPerSwing: 1, minesMithril: false } });
  });

  it('migrates a version 8 save (step 9d): talk memory, and only customers carrying an item stay', () => {
    const { lastLines: _l, ...shop } = state.shop;
    const old = (id: number, carrying: unknown) => ({ id, look: state.look, x: 1, y: 2, facing: 'up', path: [{ x: 5, y: 5 }], phase: 'browse', want: 'materials', tolerance: 1, waitMs: 0, speed: 72, shelfUid: null, browsing: true, looks: 1, carrying, reaction: null, queueSpot: -1 });
    const v8 = { ...state, shop: { ...shop, customers: [old(-1, null), old(-2, { loot: { kind: 'material', id: 'wood', qty: 1 }, price: 3 })] } };
    const r = readSave(JSON.stringify({ version: 8, savedAt: 0, state: v8 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.shop.lastLines).toEqual({});
    expect(r.state.shop.customers).toHaveLength(1);
    expect(r.state.shop.customers[0]).toMatchObject({ id: -2, kind: 'browser', phase: 'queue', path: [], seat: null, browsing: false });
  });

  it('migrates a version 9 save (natural customers): the customers in the line get a plan and the new fields', () => {
    const old = (id: number, carrying: unknown) => ({ id, kind: 'chatty', look: state.look, x: 1, y: 2, facing: 'up', path: [{ x: 5, y: 5 }], phase: 'admire', want: 'materials', tolerance: 1, waitMs: 0, speed: 72, shelfUid: null, browsing: true, looks: 1, looksMax: 2, decorLeft: 1, decorUid: null, carrying, reaction: null, queueSpot: 0, seat: null, sitChecked: false, callInMs: 100 });
    const v9 = { ...state, shop: { ...state.shop, customers: [old(-1, null), old(-2, { loot: { kind: 'material', id: 'wood', qty: 1 }, price: 3 })] } };
    const r = readSave(JSON.stringify({ version: 9, savedAt: 0, state: v9 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.shop.customers).toHaveLength(1);
    const c = r.state.shop.customers[0]!;
    expect(c).toMatchObject({ id: -2, kind: 'chatty', phase: 'queue', buys: true, plan: [], step: 0, doing: null, followId: null, talk: null, holdMs: 0, path: [] });
    expect('looksMax' in c || 'decorLeft' in c || 'looks' in c).toBe(false);
  });

  it('migrates a version 10 save (step 9e): everything the player owns counts as seen', () => {
    const { seen: _s, bookOpenedAt: _o, bookRewards: _r, ...player } = state.player;
    const shelf = state.items.find((i) => i.typeId === 'stall_table')!;
    const v10 = {
      ...state,
      player: { ...player, materials: { wood: 3, bone: 7 } },
      items: [...state.items, { uid: 50, typeId: 'chair', ownerId: 1, roomId: null, x: 0, y: 0, facing: 'down', onItemUid: null }, { uid: 51, typeId: 'chair', ownerId: 1, roomId: 1, x: 100, y: 100, facing: 'down', onItemUid: null }],
      shop: {
        ...state.shop,
        slots: [
          { shelfUid: shelf.uid, index: 0, loot: { kind: 'material', id: 'cloth', qty: 1 }, price: 5 },
          { shelfUid: shelf.uid, index: 1, loot: { kind: 'furniture', uid: 60, typeId: 'skull_lamp' }, price: 30 },
        ],
      },
    };
    const r = readSave(JSON.stringify({ version: 10, savedAt: 0, state: v10 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.player.seen).toEqual({
      wood: { count: 3, firstSeenAt: 0 },
      bone: { count: 7, firstSeenAt: 0 },
      counter: { count: 1, firstSeenAt: 0 },
      stall_table: { count: 1, firstSeenAt: 0 },
      chair: { count: 3, firstSeenAt: 0 },
      rug: { count: 1, firstSeenAt: 0 },
      cloth: { count: 1, firstSeenAt: 0 },
      skull_lamp: { count: 1, firstSeenAt: 0 },
      // The tavern's gift (migration 12, step 9t).
      round_table: { count: 1, firstSeenAt: 0 },
      bar_stool: { count: 2, firstSeenAt: 0 },
      brewing_barrel: { count: 1, firstSeenAt: 0 },
    });
    expect(r.state.player.bookOpenedAt).toBe(0);
    expect(r.state.player.bookRewards).toEqual([]);
  });

  it('migrates a version 11 save (step 9f): a level 1 lakeside with 8 whole trees and no records', () => {
    const { lakeside: _l, ...rest } = state;
    const v11 = {
      ...rest,
      rooms: rest.rooms.filter((r) => r.kind !== 'lakeside'),
      player: (({ lakesideRoomId: _id, biggest: _b, ...p }) => p)(rest.player),
    };
    const r = readSave(JSON.stringify({ version: 11, savedAt: 0, state: v11 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    const lake = r.state.rooms.find((x) => x.kind === 'lakeside');
    expect(lake).toMatchObject({ id: 4, level: 1, shape: 'lakeside', floorStyle: 'grass', wallStyle: 'hedge', w: 576, h: 384 });
    expect(r.state.player.lakesideRoomId).toBe(4);
    expect(r.state.player.biggest).toEqual({});
    expect(r.state.lakeside).toEqual({ roomId: 4, trees: Array.from({ length: 8 }, () => ({ hits: 0, felledAt: null })), axeReadyAt: 0 });
    // Nothing else changed.
    expect(r.state.rooms).toHaveLength(4);
    expect(r.state.player.seen).toEqual(v11.player.seen);
  });
  it('migrates a version 12 save (step 9t): the tavern, with a table, 2 stools and a barrel of root ale in the bag', () => {
    const START = ['round_table', 'bar_stool', 'brewing_barrel'];
    const { tavern: _t, ...rest } = state;
    const v12 = {
      ...rest,
      items: rest.items.filter((i) => !START.includes(i.typeId)),
      shop: { ...rest.shop, updatedAt: 5000 },
      player: { ...rest.player, seen: Object.fromEntries(Object.entries(rest.player.seen).filter(([id]) => !START.includes(id))) },
    };
    const r = readSave(JSON.stringify({ version: 12, savedAt: 0, state: v12 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    const s = r.state;
    // The gift is in the bag (not placed), through the ledger, with fresh uids.
    const gift = s.items.filter((i) => START.includes(i.typeId));
    expect(gift.map((i) => [i.typeId, i.roomId]).sort()).toEqual([['bar_stool', null], ['bar_stool', null], ['brewing_barrel', null], ['round_table', null]]);
    expect(gift.map((i) => i.uid)).toEqual([state.nextUid, state.nextUid + 1, state.nextUid + 2, state.nextUid + 3]);
    expect(s.nextUid).toBe(state.nextUid + 4);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'tavern_gift', goldDelta: 0, furnitureUids: gift.map((i) => i.uid) });
    expect(s.player.seen.bar_stool?.count).toBe(2);
    // The tavern is the shop room, empty, and the game still has to explain it once.
    const barrel = gift.find((i) => i.typeId === 'brewing_barrel')!;
    expect(s.tavern).toMatchObject({ roomId: s.player.shopRoomId, guests: [], mess: [], menu: {}, serveQueue: [], holding: null, introSeen: false, updatedAt: 5000 });
    expect(s.tavern.brews).toEqual([{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 5000 }]);
    // Everything else is as it was.
    expect(s.items.filter((i) => !START.includes(i.typeId))).toEqual(v12.items);
    expect(s.player.wallet).toEqual(v12.player.wallet);
    expect(s.shop).toEqual(v12.shop);
    // A new game has seen the intro already.
    expect(state.tavern.introSeen).toBe(true);
  });
});


describe('migrates a version 13 save to the cell grid (step BG1)', () => {
  const base = createNewPlayer(undefined, 1);
  const hotelId = base.player.hotelRoomId;
  const shopId = base.player.shopRoomId;
  let uid = 500;
  const piece = (typeId: string, roomId: number | null, x: number, y: number, onItemUid: number | null = null, facing: FurnitureItem['facing'] = 'down'): FurnitureItem => ({
    uid: uid++,
    typeId,
    ownerId: base.player.id,
    roomId,
    x,
    y,
    facing,
    onItemUid,
  });
  const table = piece('table', hotelId, 301, 250);
  const old = {
    ...base,
    items: [
      ...base.items,
      piece('chair', hotelId, 203, 197), // off the grid
      table,
      piece('lamp', hotelId, 311, 241, table.uid), // on the table
      piece('rug', hotelId, 120, 300),
    ],
  };
  const wall = piece('wall_torch', hotelId, 133, 0); // free along the band: stays at 133
  const oldState = { ...old, items: [...old.items, wall] };
  const run = (state: typeof oldState) => readSave(JSON.stringify({ version: 13, savedAt: 0, state }));

  it('puts every floor item on the nearest valid cells, keeps wall items where they are, riders on their surface', () => {
    const r = run(oldState);
    expect(r).toMatchObject({ ok: true, version: 13, migrated: true, returnedToBag: 0 });
    if (!r.ok) return;
    const room = r.state.rooms.find((x) => x.id === hotelId)!;
    const here = r.state.items.filter((i) => i.roomId === hotelId);
    for (const i of here.filter((x) => x.onItemUid === null && !getFurnitureType(x.typeId).wall)) {
      const t = getFurnitureType(i.typeId);
      expect(isOnGrid(i, t), i.typeId).toBe(true);
      expect(canPlace(room, here.filter((o) => o.uid !== i.uid), t, i.x, i.y, i.facing), i.typeId).toBe(true);
    }
    // Near where they were: the chair (203, 197) is within a cell or two.
    const chair = here.find((i) => i.typeId === 'chair')!;
    expect(Math.hypot(chair.x - 203, chair.y - 197)).toBeLessThanOrEqual(32);
    // The lamp rides the table, on a cell of it.
    const t = here.find((i) => i.typeId === 'table')!;
    const lamp = here.find((i) => i.typeId === 'lamp')!;
    expect(lamp.onItemUid).toBe(t.uid);
    const top = footprintRect(t, getFurnitureType('table'));
    const fp = footprintRect(lamp, getFurnitureType('lamp'));
    expect(fp.x >= top.x && fp.y >= top.y && fp.x + fp.w <= top.x + top.w && fp.y + fp.h <= top.y + top.h).toBe(true);
    expect(isOnGrid(lamp, getFurnitureType('lamp'))).toBe(true);
    // The wall item did not move.
    expect(here.find((i) => i.typeId === 'wall_torch')).toMatchObject({ x: 133, y: 0 });
    // The shop's counter is still exactly one, in the shop.
    expect(r.state.items.filter((i) => i.typeId === 'counter' && i.roomId === shopId)).toHaveLength(1);
  });

  it('what no longer fits goes back to the bag, and the count is reported (also its riders)', () => {
    const outside = piece('crate', hotelId, 2000, 2000); // far off the floor, nowhere near a free cell
    const rider = piece('lamp', hotelId, 2000, 1990, outside.uid);
    const blocker = (c: number, r: number) => piece('plant', hotelId, c * 32 + 16, (r + 1) * 32);
    const r = run({ ...oldState, items: [...oldState.items, outside, rider] });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.returnedToBag).toBe(2); // the crate and the lamp on it
    expect(r.state.items.find((i) => i.uid === outside.uid)).toMatchObject({ roomId: null });
    expect(r.state.items.find((i) => i.uid === rider.uid)).toMatchObject({ roomId: null, onItemUid: null });
    // A full room: nothing fits, so the extra item goes back to the bag.
    const room = createRoom(hotelId, 'hotel', 1, 1);
    const cells = Array.from({ length: room.w / 32 }, (_, c) => c).flatMap((c) => Array.from({ length: room.h / 32 }, (_, rr) => [c, rr] as const));
    const crowd = cells.filter(([c, rr]) => !(c >= 8 && c <= 9 && rr >= 10)).map(([c, rr]) => blocker(c, rr));
    const full = { ...base, items: [...base.items, ...crowd, piece('chair', hotelId, 203, 197)] };
    const r2 = run(full);
    expect(r2).toMatchObject({ ok: true });
    if (!r2.ok) return;
    // Walking in must stay possible and everything on the floor is valid; some items went back to the bag.
    expect(r2.returnedToBag).toBeGreaterThan(0);
    const inBag = r2.state.items.filter((i) => i.roomId === null).length;
    expect(inBag).toBeGreaterThanOrEqual(r2.returnedToBag);
  });

  it('the room sizes come from the cell data (a wide hall was 240 high, now 8 cells)', () => {
    const wide = { ...oldState, rooms: oldState.rooms.map((x) => (x.id === hotelId ? { ...x, shape: 'wide_hall', w: 832, h: 240 } : x)), items: [] as FurnitureItem[] };
    const r = run(wide);
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.state.rooms.find((x) => x.id === hotelId)).toMatchObject({ shape: 'wide_hall', w: 832, h: 256 });
  });
});
