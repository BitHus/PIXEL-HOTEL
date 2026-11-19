import { describe, expect, it } from 'vitest';
import { MIGRATIONS, readSave as readSaveReal, saveKey, toSaveText } from './save.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import { save41Start } from './tavernTest.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { FARM_HINT, HINTS, MINE_HINT, PACK_HINT, SAVE_VERSION, SPLICE_HINT } from './config.ts';
import { canPlace, footprintRect, getFurnitureType, isOnGrid } from './furniture.ts';
import { createRoom, plantInCell, floorStyleAt } from './room.ts';
import { innDoorSpots } from './innDoors.ts';
import { growthStage, soilCells } from './farm.ts';
import { SOIL_STYLE } from './config.ts';
import { testRun } from './dungeon/testRun.ts';
import type { FurnitureItem } from './types.ts';
import type { BlockCell } from './blockTypes.ts';

/** The rules tests of the old versions start from a new game with the stove and barrel in the tavern (they stand in the walled kitchen area there). */
function oldNew(): ReturnType<typeof createNewPlayer> {
  return save41Start('square_shop', 1);
}
// The old-version tests below check the migrations up to save 41 (what they were written for); 41 -> 42 (modular bar, kitchen above) is tested in kitchenAboveMigration.test.ts.
const readSave = (text: string) => readSaveReal(text, 41);

const state = applyChange(oldNew(), { reason: 'debug', addFurniture: ['chair', 'rug'] }, 2)!;

describe('save files', () => {
  it('saving then loading gives an identical state', () => {
    const loaded = readSave(toSaveText(state, 3));
    expect(loaded).toEqual({ ok: true, state, version: SAVE_VERSION, migrated: false, returnedToBag: 0, farmChanged: false, kitchenChanged: false, shopClosed: false, barChanged: false, doorsChanged: 0 });
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
    const { bag: _bag, hintsDone: _h, ...v1 } = state;
    const r = readSave(JSON.stringify({ version: 1, savedAt: 0, state: v1 }));
    expect(r).toMatchObject({ ok: true, version: 1, migrated: true });
    if (!r.ok) return;
    expect(r.state.bag.furniture.every((s) => s === null)).toBe(true);
    const arranged = arrangeState(r.state);
    expect(arranged.bag.furniture.slice(0, 2)).toEqual(['chair', 'rug']);
    expect(arranged.bag.materials.slice(0, 2)).toEqual(['wood', 'cloth']);
  });

  it('migrates a version 2 save: no hints done, and the counter and stall_table in the shop', () => {
    const { hintsDone: _h, ...rest } = state;
    const v2 = { ...rest, items: rest.items.filter((i) => i.roomId === null) };
    const r = readSave(JSON.stringify({ version: 2, savedAt: 0, state: v2 }));
    expect(r).toMatchObject({ ok: true, version: 2, migrated: true });
    if (!r.ok) return;
    expect(r.state.hintsDone).toBe(0);
    expect('shop' in r.state).toBe(false); // dropped again by migration 21 -> 22 (step S1)
    const inShop = r.state.items.filter((i) => i.roomId === r.state.player.shopRoomId).map((i) => i.typeId);
    expect(inShop.sort()).toEqual(['counter', 'register', 'stall_table', 'stove', 'tap_stand']); // the stove comes with migration 20 -> 21 (step K1), the register and the tap stand with 23 -> 24 (step T1)
    expect(new Set(r.state.items.map((i) => i.uid)).size).toBe(r.state.items.length);
  });

  it('migrates a version 3 save: a counter against the back wall moves out so the player fits behind it', () => {
    const v3 = { ...state, items: state.items.map((i) => (i.typeId === 'counter' ? { ...i, x: 176, y: 40 } : i)) };
    const r = readSave(JSON.stringify({ version: 3, savedAt: 0, state: v3 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.items.find((i) => i.typeId === 'counter')).toMatchObject({ y: 96 }); // on the cell grid (step BG1)
  });

  it('migrates a version 4 save: square rooms, the old look as clothing, and no character creation', () => {
    const { playerCreated: _p, lakeside: _l, ...rest } = state;
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
    const { lakeside: _l, ...rest } = state;
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
    // Migration 15 -> 16 turned the six empty plots into six soil cells (no plants), and dropped GameState.farm.
    expect(Object.keys(farm!.floorCells ?? {})).toHaveLength(6);
    expect(farm!.plants).toEqual({});
    expect('farm' in r.state).toBe(false);
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

  // The old customer migrations are checked one step at a time: the shop state they work on is gone from GameState since step S1.
  const shopOf = (extra: Record<string, unknown>) => ({ roomId: state.tavern.roomId, slots: [], nextCustomerInMs: 10_000, saleHistory: {}, customers: [], nextCustomerId: -1, updatedAt: 0, ...extra });

  it('migrates a version 8 save (step 9d): talk memory, and only customers carrying an item stay (step 8 -> 9 itself)', () => {
    const old = (id: number, carrying: unknown) => ({ id, look: state.look, x: 1, y: 2, facing: 'up', path: [{ x: 5, y: 5 }], phase: 'browse', want: 'materials', tolerance: 1, waitMs: 0, speed: 72, shelfUid: null, browsing: true, looks: 1, carrying, reaction: null, queueSpot: -1 });
    const v8 = { ...state, shop: shopOf({ customers: [old(-1, null), old(-2, { loot: { kind: 'material', id: 'wood', qty: 1 }, price: 3 })] }) };
    const out = MIGRATIONS[8]!(v8) as { shop: { lastLines: unknown; customers: Record<string, unknown>[] } };
    expect(out.shop.lastLines).toEqual({});
    expect(out.shop.customers).toHaveLength(1);
    expect(out.shop.customers[0]).toMatchObject({ id: -2, kind: 'browser', phase: 'queue', path: [], seat: null, browsing: false });
    // The whole chain to today ends without any shop state.
    const r = readSave(JSON.stringify({ version: 8, savedAt: 0, state: v8 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) expect('shop' in r.state).toBe(false);
  });

  it('migrates a version 9 save (natural customers): the customers in the line get a plan and the new fields (step 9 -> 10 itself)', () => {
    const old = (id: number, carrying: unknown) => ({ id, kind: 'chatty', look: state.look, x: 1, y: 2, facing: 'up', path: [{ x: 5, y: 5 }], phase: 'admire', want: 'materials', tolerance: 1, waitMs: 0, speed: 72, shelfUid: null, browsing: true, looks: 1, looksMax: 2, decorLeft: 1, decorUid: null, carrying, reaction: null, queueSpot: 0, seat: null, sitChecked: false, callInMs: 100 });
    const v9 = { ...state, shop: shopOf({ customers: [old(-1, null), old(-2, { loot: { kind: 'material', id: 'wood', qty: 1 }, price: 3 })] }) };
    const out = MIGRATIONS[9]!(v9) as { shop: { customers: Record<string, unknown>[] } };
    expect(out.shop.customers).toHaveLength(1);
    const c = out.shop.customers[0]!;
    expect(c).toMatchObject({ id: -2, kind: 'chatty', phase: 'queue', buys: true, plan: [], step: 0, doing: null, followId: null, talk: null, holdMs: 0, path: [] });
    expect('looksMax' in c || 'decorLeft' in c || 'looks' in c).toBe(false);
    expect(readSave(JSON.stringify({ version: 9, savedAt: 0, state: v9 }))).toMatchObject({ ok: true, migrated: true });
  });

  it('migrates a version 10 save (step 9e): everything the player owns counts as seen', () => {
    const { seen: _s, bookOpenedAt: _o, bookRewards: _r, ...player } = state.player;
    // An old save has the stall table (a new game does not any more, S3): put one in the shop.
    const shelf = { uid: 49, typeId: 'stall_table', ownerId: 1, roomId: state.player.shopRoomId, x: 304, y: 192, facing: 'down', onItemUid: null };
    const v10 = {
      ...state,
      player: { ...player, materials: { wood: 3, bone: 7 } },
      items: [...state.items, shelf, { uid: 50, typeId: 'chair', ownerId: 1, roomId: null, x: 0, y: 0, facing: 'down', onItemUid: null }, { uid: 51, typeId: 'chair', ownerId: 1, roomId: 1, x: 100, y: 100, facing: 'down', onItemUid: null }],
      shop: shopOf({
        slots: [
          { shelfUid: shelf.uid, index: 0, loot: { kind: 'material', id: 'cloth', qty: 1 }, price: 5 },
          { shelfUid: shelf.uid, index: 1, loot: { kind: 'furniture', uid: 60, typeId: 'skull_lamp' }, price: 30 },
        ],
      }),
    };
    const r = readSave(JSON.stringify({ version: 10, savedAt: 0, state: v10 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.player.seen).toEqual({
      stove: { count: 1, firstSeenAt: 0 }, // the kitchen's gift (step K1)
      wood: { count: 3, firstSeenAt: 0 },
      bone: { count: 7, firstSeenAt: 0 },
      counter: { count: 1, firstSeenAt: 0 },
      stall_table: { count: 1, firstSeenAt: 0 },
      chair: { count: 3, firstSeenAt: 0 },
      rug: { count: 1, firstSeenAt: 0 },
      cloth: { count: 1, firstSeenAt: 0 },
      skull_lamp: { count: 1, firstSeenAt: 0 },
      // The tavern's gift (migration 12, step 9t).
      table: { count: 1, firstSeenAt: 0 },
      bar_stool: { count: 3, firstSeenAt: 0 }, // the new game now has a third stool at the bar (S3)
      brewing_barrel: { count: 1, firstSeenAt: 0 },
      register: { count: 1, firstSeenAt: 0 }, // the bar's gift (step T1)
      tap_stand: { count: 1, firstSeenAt: 0 },
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
    const START = ['table', 'bar_stool', 'brewing_barrel'];
    const { tavern: _t, ...rest } = state;
    const v12 = {
      ...rest,
      items: rest.items.filter((i) => !START.includes(i.typeId)),
      shop: shopOf({ updatedAt: 5000 }),
      player: { ...rest.player, seen: Object.fromEntries(Object.entries(rest.player.seen).filter(([id]) => !START.includes(id))) },
    };
    const r = readSave(JSON.stringify({ version: 12, savedAt: 0, state: v12 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    const s = r.state;
    // The gift is in the bag (not placed), through the ledger, with fresh uids.
    const gift = s.items.filter((i) => START.includes(i.typeId));
    expect(gift.map((i) => [i.typeId, i.roomId]).sort()).toEqual([['bar_stool', null], ['bar_stool', null], ['brewing_barrel', null], ['table', null]]);
    expect(gift.map((i) => i.uid)).toEqual([state.nextUid, state.nextUid + 1, state.nextUid + 2, state.nextUid + 3]);
    expect(s.nextUid).toBe(state.nextUid + 4);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'tavern_gift', goldDelta: 0, furnitureUids: gift.map((i) => i.uid) });
    expect(s.player.seen.bar_stool?.count).toBe(2);
    // The tavern is the shop room, empty, and the game still has to explain it once.
    const barrel = gift.find((i) => i.typeId === 'brewing_barrel')!;
    expect(s.tavern).toMatchObject({ roomId: s.player.shopRoomId, guests: [], mess: [], menu: {}, serveQueue: [], tray: [], introSeen: false, updatedAt: 5000 });
    expect(s.tavern.brews).toEqual([{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 5000 }]);
    // Everything else is as it was.
    expect(s.items.filter((i) => !START.includes(i.typeId))).toEqual(v12.items);
    expect(s.player.wallet).toEqual(v12.player.wallet);
    // A new game has seen the intro already.
    expect(state.tavern.introSeen).toBe(true);
  });
});


describe('migrates a version 13 save to the cell grid (step BG1)', () => {
  const base = oldNew();
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

describe('14 -> 15 (step BG5: blocks and gems)', () => {
  it('gives every room an empty block layer and the wallet 0 gems', () => {
    const now = oldNew();
    const old = {
      ...now,
      rooms: now.rooms.map((r) => {
        const { blocks: _blocks, ...rest } = r;
        return rest;
      }),
      player: { ...now.player, wallet: { gold: 77 } },
    };
    const r = readSave(JSON.stringify({ version: 14, savedAt: 5, state: old }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 14 });
    if (!r.ok) return;
    expect(r.state.rooms.length).toBe(now.rooms.length);
    for (const room of r.state.rooms) expect(room.blocks).toEqual({});
    expect(r.state.player.wallet).toEqual({ gold: 77, gems: 0 });
    // Nothing else changed.
    expect(r.state.items).toEqual(now.items);
  });
});

describe('15 -> 16 (step BG6: seeds and the free-form farm)', () => {
  const MIN = 60_000;
  const now = oldNew();
  const farmId = now.player.farmRoomId;
  /** A version 15 farm: plots in the old order, some planted. The old plots 0, 3 (level 1) are turnip and pumpkin. */
  const oldFarm = {
    roomId: farmId,
    plots: [
      { crop: 'turnip', plantedAt: 10_000 }, // 5 min grow time
      { crop: null, plantedAt: 0 },
      { crop: null, plantedAt: 0 },
      { crop: 'pumpkin', plantedAt: 20_000 }, // 120 min
      { crop: null, plantedAt: 0 },
      { crop: null, plantedAt: 0 },
    ],
  };
  const old = {
    ...now,
    rooms: now.rooms.map((r) => {
      const { plants: _p, floorCells: _f, ...rest } = r;
      return rest;
    }),
    farm: oldFarm,
    player: { ...now.player, materials: { ...now.player.materials, turnip_seed: 2, carrot: 3 } },
  };
  const result = () => readSave(JSON.stringify({ version: 15, savedAt: 9, state: old }));

  it('turns each old plot into a soil cell on the cell grid, and drops the farm key', () => {
    const r = result();
    expect(r).toMatchObject({ ok: true, migrated: true, version: 15, farmChanged: true });
    if (!r.ok) return;
    expect('farm' in r.state).toBe(false);
    const room = r.state.rooms.find((x) => x.id === farmId)!;
    // Level 1 plots: x 64/128/192, y 64/128 = cells (2,2) (2,4) (4,2) (4,4) (6,2) (6,4).
    expect(soilCells(room).map((c) => `${c.c},${c.r}`).sort()).toEqual(['2,2', '2,4', '4,2', '4,4', '6,2', '6,4']);
    expect(floorStyleAt(room, 2, 2)).toBe(SOIL_STYLE);
    for (const other of r.state.rooms.filter((x) => x.id !== farmId)) expect(other.plants).toEqual({});
  });

  it('planted crops become plants with the same crop, planting time and time left', () => {
    const r = result();
    if (!r.ok) throw new Error('not ok');
    const room = r.state.rooms.find((x) => x.id === farmId)!;
    const turnip = plantInCell(room, 2, 2)!;
    expect(turnip).toEqual({ seed: 'turnip_seed', plantedAt: 10_000, readyAt: 10_000 + 2 * MIN });
    const pumpkin = plantInCell(room, 4, 4)!; // plot 3 = (128, 128)
    expect(pumpkin).toEqual({ seed: 'pumpkin_seed', plantedAt: 20_000, readyAt: 20_000 + 20 * MIN });
    // The same stage as the old plot had: half the time gone = the small plant, then ripe at the same moment.
    expect(growthStage(turnip, 10_000 + 0.8 * MIN)).toBe('sprout');
    expect(growthStage(turnip, 10_000 + 1.2 * MIN)).toBe('small');
    expect(growthStage(turnip, 10_000 + 2 * MIN)).toBe('full');
    expect(plantInCell(room, 6, 2)).toBeNull();
  });

  it('loses nothing: seeds and crops in the bag and the other rooms stay as they were', () => {
    const r = result();
    if (!r.ok) throw new Error('not ok');
    expect(r.state.player.materials).toEqual(old.player.materials);
    expect(r.state.player.wallet).toEqual(old.player.wallet);
    expect(r.state.items).toEqual(old.items);
    expect(r.state.ledger).toEqual(old.ledger);
    expect(r.state.rooms.find((x) => x.id === farmId)).toMatchObject({ level: 1, floorStyle: 'grass', wallStyle: 'hedge' });
    // A current save is not "farm changed".
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false, farmChanged: false });
  });

  it('a level 3 farm keeps all 20 plots as soil cells', () => {
    const lvl3 = { ...old, farm: { roomId: farmId, plots: Array.from({ length: 20 }, () => ({ crop: null, plantedAt: 0 })) } };
    const r = readSave(JSON.stringify({ version: 15, savedAt: 9, state: lvl3 }));
    if (!r.ok) throw new Error('not ok');
    expect(soilCells(r.state.rooms.find((x) => x.id === farmId)!)).toHaveLength(20);
  });
});

describe('16 -> 17 (step BG4: gems in a saved run)', () => {
  const now = oldNew();
  const run = testRun();
  const oldBag = (b: { slots: unknown[]; gold: number }) => ({ slots: b.slots, gold: b.gold });
  const oldRun = (() => {
    const { pickups: _p, ...rest } = run;
    return { ...rest, bag: oldBag({ slots: [], gold: 7 }), banked: oldBag({ slots: [], gold: 0 }), lost: oldBag({ slots: [], gold: 0 }) };
  })();

  it('gives a saved run 0 gems in every bag and an empty floor, and keeps its gold', () => {
    const r = readSave(JSON.stringify({ version: 16, savedAt: 9, state: { ...now, run: oldRun } }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.run?.bag).toEqual({ slots: [], gold: 7, gems: 0 });
    expect(r.state.run?.banked.gems).toBe(0);
    expect(r.state.run?.lost.gems).toBe(0);
    expect(r.state.run?.pickups).toEqual([]);
  });

  it('a save without a run is unchanged', () => {
    const r = readSave(JSON.stringify({ version: 16, savedAt: 9, state: { ...now, run: null } }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) expect(r.state.run).toBeNull();
  });
});

describe('19 -> 20 (step BG9: the pack quest sits before the mine quest)', () => {
  const now = oldNew();
  it('moves a player who was at the mine quest (5) or later up by one, and leaves earlier ones alone', () => {
    for (const [from, to] of [[0, 0], [4, 4], [5, 6], [6, 7], [7, 8]] as const) {
      const r = readSave(JSON.stringify({ version: 19, savedAt: 9, state: { ...now, hintsDone: from } }));
      expect(r, `from ${from}`).toMatchObject({ ok: true });
      if (r.ok) expect(r.state.hintsDone).toBe(to);
    }
  });
  it('the quest indexes keep their order: farm, pack, mine, splice', () => {
    expect([FARM_HINT, PACK_HINT, MINE_HINT, SPLICE_HINT]).toEqual([4, 5, 6, 7]);
    expect(HINTS).toHaveLength(8);
  });
});

describe('20 -> 21 (step K1: cooking moves to a stove in the tavern)', () => {
  /** What a version 20 save looked like: no stove, no cooks list, a farm with a planted turnip and some crops. */
  const v20 = (): Record<string, unknown> => {
    const base = applyChange(oldNew(), { reason: 'debug', materials: { turnip: 3, potato: 2 }, gold: 50 }, 2)!;
    const farm = base.rooms.find((r) => r.kind === 'farm')!;
    const planted = { ...base, rooms: base.rooms.map((r) => (r.id === farm.id ? { ...r, plants: { '3,2': { seed: 'turnip_seed', plantedAt: 5, readyAt: 125_005 } } } : r)) };
    const items = planted.items.filter((i) => i.typeId !== 'stove');
    const { cooks: _cooks, ...tavern } = planted.tavern;
    const { stove: _seen, ...seen } = planted.player.seen;
    return { ...planted, items, tavern, player: { ...planted.player, seen } };
  };
  const load = (state: unknown) => readSave(JSON.stringify({ version: 20, savedAt: 9, state }));

  it('gives the tavern one stove on its start spot, an empty cooks list, and says so', () => {
    const r = load(v20());
    expect(r).toMatchObject({ ok: true, migrated: true, version: 20, kitchenChanged: true });
    if (!r.ok) return;
    const stoves = r.state.items.filter((i) => i.typeId === 'stove');
    expect(stoves).toHaveLength(1);
    expect(stoves[0]).toMatchObject({ roomId: r.state.tavern.roomId, x: 160, y: 384, facing: 'down' }); // the start spot is inside the kitchen annex since save 39
    expect(r.state.tavern.cooks).toEqual([]);
    expect(r.state.ledger.at(-1)).toMatchObject({ reason: 'tavern_gift', note: 'cooking moved to the tavern' });
    expect(r.state.player.seen.stove?.count).toBe(1);
    // A new save from here on does not say it again.
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false, kitchenChanged: false });
  });

  it('puts the stove in the bag when its spot is taken', () => {
    const s = v20() as unknown as ReturnType<typeof createNewPlayer>;
    // Move the brewing barrel onto the stove's spot.
    const items = s.items.map((i) => (i.typeId === 'brewing_barrel' ? { ...i, x: 144, y: 384 } : i));
    const r = load({ ...s, items });
    expect(r).toMatchObject({ ok: true, kitchenChanged: true });
    if (!r.ok) return;
    const stove = r.state.items.find((i) => i.typeId === 'stove')!;
    expect(stove.roomId).toBeNull();
    expect(r.state.bag.furniture.some((x) => x === 'stove') || r.state.hotbar.some((x) => x === 'stove')).toBe(true);
  });

  it('loses nothing: crops, gold, the planted turnip and the ledger stay; the old pot spot of the farm is free', () => {
    const before = v20() as unknown as ReturnType<typeof createNewPlayer>;
    const r = load(before);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.player.materials).toEqual(before.player.materials);
    expect(r.state.player.wallet).toEqual(before.player.wallet);
    expect(r.state.rooms.find((x) => x.kind === 'farm')!.plants).toEqual({ '3,2': { seed: 'turnip_seed', plantedAt: 5, readyAt: 125_005 } });
    expect(r.state.items.filter((i) => i.typeId !== 'stove')).toEqual(before.items);
    expect(r.state.ledger.slice(0, before.ledger.length)).toEqual(before.ledger);
  });

  it('a save that already has a stove keeps it (no second one)', () => {
    const withStove = oldNew();
    const { cooks: _c, ...tavern } = withStove.tavern;
    const r = load({ ...withStove, tavern });
    expect(r.ok && r.state.items.filter((i) => i.typeId === 'stove')).toHaveLength(1);
  });

  it('an old save from version 12 gets exactly one stove too', () => {
    const r12 = oldNew();
    const { tavern: _t, ...old } = { ...r12, items: r12.items.filter((i) => !['stove', 'table', 'bar_stool', 'brewing_barrel'].includes(i.typeId)) };
    const r = readSave(JSON.stringify({ version: 12, savedAt: 9, state: old }));
    expect(r).toMatchObject({ ok: true, kitchenChanged: true });
    if (r.ok) expect(r.state.items.filter((i) => i.typeId === 'stove')).toHaveLength(1);
  });
});

describe('21 -> 22 (step S1: the shop is the tavern, nobody sells loot to customers any more)', () => {
  /** What a version 21 save looked like: GameState.shop with goods on slots, a sale history and walking customers. */
  const v21 = () => {
    const base = applyChange(oldNew(), { reason: 'debug', materials: { wood: 5, cloth: 2 }, addFurniture: ['chair'], gold: 40 }, 2)!;
    const chair = base.items.find((i) => i.typeId === 'chair')!;
    // Two goods on the stall: one wood (a material) and the chair (furniture, out of the items list while it is on the slot).
    const onStall = applyChange(base, { reason: 'shelf', materials: { wood: -1 }, removeFurniture: [chair.uid], note: 'on sale' }, 3)!;
    const { tavern, ...rest } = onStall;
    const { nextGuestId: _n, ...oldTavern } = tavern as typeof tavern & { nextGuestId?: number };
    const shop = {
      roomId: tavern.roomId,
      slots: [
        { shelfUid: 1, index: 0, loot: { kind: 'material', id: 'wood', qty: 1 }, price: 7 },
        { shelfUid: 1, index: 1, loot: { kind: 'furniture', uid: chair.uid, typeId: 'chair' }, price: 30 },
        { shelfUid: 1, index: 2, loot: null, price: 5 },
      ],
      nextCustomerInMs: 5000,
      saleHistory: { wood: [4, 5] },
      customers: [{ id: -3, phase: 'queue', carrying: { kind: 'material', id: 'wood', qty: 1 } }],
      nextCustomerId: -7,
      updatedAt: 1234,
      lastLines: { enter: 2 },
    };
    return { before: onStall, old: { ...rest, tavern: oldTavern, shop } };
  };
  const load = (state: unknown) => readSave(JSON.stringify({ version: 21, savedAt: 9, state }));

  it('all goods on slots go back to the bag, with the same furniture uid', () => {
    const { before, old } = v21();
    const r = load(old);
    expect(r).toMatchObject({ ok: true, migrated: true, version: 21 });
    if (!r.ok) return;
    expect(r.state.player.materials.wood).toBe(before.player.materials.wood! + 1);
    const chair = r.state.items.find((i) => i.typeId === 'chair')!;
    expect(chair.roomId).toBeNull();
    expect(chair.uid).toBe(old.shop.slots[1]!.loot!.uid);
    expect(r.state.items).toHaveLength(before.items.length + 1);
  });

  it('the customer state is dropped; the guest id counter carries on from the shop counter', () => {
    const r = load(v21().old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('shop' in r.state).toBe(false);
    expect(r.state.tavern.nextGuestId).toBe(-7);
  });

  it('stalls, shelves and cases stay where they are, and the ledger still adds up', () => {
    const { before, old } = v21();
    const r = load(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.items.filter((i) => i.typeId === 'stall_table')).toEqual(before.items.filter((i) => i.typeId === 'stall_table'));
    expect(r.state.player.wallet).toEqual(before.player.wallet);
    expect(r.state.ledger.slice(0, before.ledger.length)).toEqual(before.ledger);
    const back = r.state.ledger.slice(before.ledger.length);
    expect(back.length).toBeGreaterThan(0);
    expect(back.every((e) => e.reason === 'shop_closed' && e.goldDelta === 0)).toBe(true);
    // Replaying the ledger gives the wallet and the materials of the state: nothing was lost or made.
    expect(ledgerGold(r.state)).toBe(r.state.player.wallet.gold);
    expect(r.state.player.materials).toEqual(ledgerMaterials(r.state));
  });

  it('a save with no goods on the slots loses nothing and gets no ledger entry', () => {
    const base = oldNew();
    const { tavern, ...rest } = base;
    const { nextGuestId: _n, ...oldTavern } = tavern as typeof tavern & { nextGuestId?: number };
    const old = { ...rest, tavern: oldTavern, shop: { roomId: tavern.roomId, slots: [], nextCustomerInMs: 1, saleHistory: {}, customers: [], nextCustomerId: -1, updatedAt: 0, lastLines: {} } };
    const r = load(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.ledger).toEqual(base.ledger);
    expect(r.state.items).toEqual(base.items);
  });

  it('a new save does not migrate again', () => {
    const r = load(v21().old);
    if (!r.ok) throw new Error('load failed');
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
  });
});

describe('22 -> 23 (step S3: a table spot can hold the gem a happy guest tipped)', () => {
  /** A version 22 save: piles on tables have coins and a dish but no `gems`. */
  const v22 = () => {
    const base = oldNew();
    const { version: _v, ...rest } = { version: 22, ...base };
    const mess = [
      { id: 1, seatUid: 4, seatIndex: 0, x: 400, y: 224, coins: 9, dish: 'root_ale' },
      { id: 2, seatUid: 5, seatIndex: 0, x: 496, y: 224, coins: 14, dish: null },
    ];
    return { before: base, old: { ...rest, tavern: { ...base.tavern, mess, nextMessId: 3 } } };
  };
  const load = (state: unknown) => readSave(JSON.stringify({ version: 22, savedAt: 9, state }));

  it('every pile on a table gets 0 gems and keeps its coins and dish', () => {
    const r = load(v22().old);
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.tavern.mess).toEqual([
      { id: 1, seatUid: 4, seatIndex: 0, x: 400, y: 224, coins: 9, gems: 0, dish: 'root_ale' },
      { id: 2, seatUid: 5, seatIndex: 0, x: 496, y: 224, coins: 14, gems: 0, dish: null },
    ]);
    expect(r.state.tavern.nextMessId).toBe(3);
  });

  it('nothing else changes: the wallet, the ledger, the items, the menu and the brews are the same', () => {
    const { before, old } = v22();
    const r = load(old);
    if (!r.ok) throw new Error('load failed');
    expect(r.state.player).toEqual(before.player);
    expect(r.state.ledger).toEqual(before.ledger);
    expect(r.state.items).toEqual(before.items);
    expect(r.state.tavern.menu).toEqual(before.tavern.menu);
    expect(r.state.tavern.brews).toEqual(before.tavern.brews);
  });

  it('a save with no piles on tables migrates and a new save does not migrate again', () => {
    const base = oldNew();
    const r = load(base);
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.tavern.mess).toEqual([]);
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
  });
});

describe('migration 23 -> 24 (step T1: taps, the register, the kitchen)', () => {
  /** A version 23 save: the bar is a plain counter (no register, no tap stand), no taps; 7 root ale sit in the bag. */
  const v23 = (mutate: (items: FurnitureItem[]) => FurnitureItem[] = (i) => i) => {
    const base = oldNew();
    const items = mutate(base.items.filter((i) => i.typeId !== 'register' && i.typeId !== 'tap_stand'));
    const { taps: _t, ...tavern } = base.tavern;
    let state = { ...base, items, tavern };
    state = applyChange(state as typeof base, { reason: 'debug', materials: { root_ale: 7 } }, 1) as typeof base;
    return { before: state, old: state as unknown };
  };
  const load = (state: unknown) => readSave(JSON.stringify({ version: 23, savedAt: 9, state }));
  const bar = (s: ReturnType<typeof createNewPlayer>) => s.items.find((i) => i.typeId === 'counter')!;

  it('SAVE_VERSION is 42 (41 -> 42 the modular bar and the kitchen above, 38 -> 39 the kitchen is an attached annex, 37 -> 38 optional Player.skills, 36 -> 37 the kitchen is a walled tavern area again, 35 -> 36 the cellar room, 34 -> 35 kitchen and cellar room kinds, 33 -> 34 ledger folding, 32 -> 33 daily quests, 31 -> 32 stacked blocks, 30 -> 31 the waiter tray, 29 -> 30 plants on blocks, 28 -> 29 the hands-on pour, 23 -> 24 the bar fittings, 24 -> 25 the Inn name, 25 -> 26 the casks, 26 -> 27 the Inn doors, 27 -> 28 usable pieces and the cat) and the migrations exist', () => {
    expect(SAVE_VERSION).toBe(42);
    expect(typeof MIGRATIONS[41]).toBe('function');
    expect(typeof MIGRATIONS[23]).toBe('function');
    expect(typeof MIGRATIONS[24]).toBe('function');
    expect(typeof MIGRATIONS[25]).toBe('function');
  });

  it('the tavern gets a register and a tap stand ON the bar, side by side; the taps start empty; the drinks in the bag stay in the bag', () => {
    const { before, old } = v23();
    const r = load(old);
    expect(r).toMatchObject({ ok: true, migrated: true, barChanged: true });
    if (!r.ok) return;
    const s = r.state;
    expect(s.tavern.taps).toEqual([]);
    expect(s.player.materials.root_ale).toBe(before.player.materials.root_ale); // nothing moved to a tap by itself
    const riders = s.items.filter((i) => i.onItemUid === bar(s).uid);
    expect(riders.map((i) => i.typeId).sort()).toEqual(['register', 'tap_stand']);
    for (const i of riders) expect(i.roomId).toBe(s.tavern.roomId);
    const [a, b] = riders.map((i) => footprintRect(i, getFurnitureType(i.typeId))).sort((p, q) => p.x - q.x) as [ReturnType<typeof footprintRect>, ReturnType<typeof footprintRect>];
    expect(a.x + a.w).toBe(b.x);
    expect(new Set(s.items.map((i) => i.uid)).size).toBe(s.items.length);
    expect(s.items.filter((i) => i.roomId === null)).toEqual([]);
  });

  it('through the ledger (tavern_gift): the ledger still adds up, gold and gems are untouched, nothing else changes', () => {
    const { before, old } = v23();
    const r = load(old);
    if (!r.ok) throw new Error('load failed');
    const gifts = r.state.ledger.filter((e) => e.reason === 'tavern_gift' && e.note === 'the bar has a register and taps now');
    expect(gifts).toHaveLength(2);
    expect(ledgerGold(r.state)).toBe(r.state.player.wallet.gold);
    expect(ledgerMaterials(r.state)).toEqual(r.state.player.materials);
    expect(r.state.player.wallet).toEqual(before.player.wallet);
    expect(r.state.tavern.menu).toEqual(before.tavern.menu);
    expect(r.state.tavern.cooks).toEqual(before.tavern.cooks);
    expect(r.state.items.filter((i) => !['register', 'tap_stand'].includes(i.typeId))).toEqual(before.items);
  });

  it('when the bar has no free cell the pieces wait in the bag (still owned, still in the ledger)', () => {
    const { old } = v23((items) => {
      const b = items.find((i) => i.typeId === 'counter')!;
      // Three plain-decor items would not do (they are not surfaces' riders): fill the bar with 3 other riders of an on-surface type.
      const filler = [-32, 0, 32].map((dx, k) => ({ uid: 200 + k, typeId: 'tap_stand', ownerId: 1, roomId: b.roomId, x: b.x + dx, y: b.y, facing: 'down' as const, onItemUid: b.uid }));
      return [...items, ...filler];
    });
    const r = load(old);
    if (!r.ok) throw new Error('load failed');
    // A save that already has a tap stand keeps it and only gets the register: with all 3 cells taken it goes to the bag.
    expect(r.state.items.filter((i) => i.typeId === 'tap_stand')).toHaveLength(3);
    const reg = r.state.items.filter((i) => i.typeId === 'register');
    expect(reg).toHaveLength(1);
    expect(reg[0]).toMatchObject({ roomId: null, onItemUid: null });
    expect(ledgerMaterials(r.state)).toEqual(r.state.player.materials);
  });

  it('a save that already has a register and a tap stand keeps exactly one of each; a migrated save does not migrate again', () => {
    const base = oldNew();
    const r = load(base);
    if (!r.ok) throw new Error('load failed');
    expect(r.state.items.filter((i) => i.typeId === 'register')).toHaveLength(1);
    expect(r.state.items.filter((i) => i.typeId === 'tap_stand')).toHaveLength(1);
    expect(r.state.tavern.taps).toEqual(base.tavern.taps);
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false, barChanged: false });
  });

  it('a bar that was turned and moved still takes both pieces (the first free cells along its long side)', () => {
    const { old } = v23((items) => items.map((i) => (i.typeId === 'counter' ? { ...i, x: 240, y: 320, facing: 'right' as const } : i)));
    const r = load(old);
    if (!r.ok) throw new Error('load failed');
    const b = bar(r.state);
    const riders = r.state.items.filter((i) => i.onItemUid === b.uid);
    expect(riders).toHaveLength(2);
    const fp = footprintRect(b, getFurnitureType('counter'));
    for (const i of riders) {
      const f = footprintRect(i, getFurnitureType(i.typeId));
      expect(f.x >= fp.x && f.x + f.w <= fp.x + fp.w && f.y >= fp.y && f.y + f.h <= fp.y + fp.h).toBe(true);
    }
  });

  it('every older save (v1) still loads through the whole chain and ends with taps and a bar that has its pieces', () => {
    const base = oldNew();
    const { bag: _b, hintsDone: _h, tavern: _t, ...v1 } = base;
    expect(readSave(JSON.stringify({ version: 1, savedAt: 0, state: v1 })).ok).toBe(true);
  });
});

describe('migrates a version 24 save (MB-1, the Inn name)', () => {
  it('gives an old save the default Inn name, keeps a name that is already there, and does not migrate twice', () => {
    const base = oldNew();
    const { innName: _gone, ...player } = base.player;
    const old = { ...base, player };
    const r = readSave(JSON.stringify({ version: 24, savedAt: 9, state: old }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 24 });
    if (!r.ok) return;
    expect(r.state.player.innName).toBe('Your Tavern');
    expect({ ...r.state.player, innName: undefined }).toEqual({ ...base.player, innName: undefined });
    expect(r.state.items).toEqual(base.items);
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
    expect(MIGRATIONS[24]!({ ...old, player: { ...player, innName: 'Mine' } })).toMatchObject({ player: { innName: 'Mine' } });
  });
});

describe('migrates a version 26 save (MB-2, Inn doors)', () => {
  it('sends furniture, blocks and plants on a door spot back to the bag, keeps everything else, and does not migrate twice', () => {
    const base = oldNew();
    const hotel = base.rooms.find((r) => r.kind === 'hotel')!;
    const farm = base.rooms.find((r) => r.kind === 'farm')!;
    const spot = innDoorSpots(hotel)[0]!;
    const fspot = innDoorSpots(farm)[0]!;
    const uid = base.nextUid;
    const chair = { uid, typeId: 'chair', ownerId: base.player.id, roomId: hotel.id, x: spot.col * 32 + 16, y: (spot.row + 1) * 32, facing: 'down' as const, onItemUid: null };
    const keep = { ...chair, uid: uid + 1, x: 16, y: 320 };
    const old = {
      ...base,
      nextUid: uid + 2,
      items: [...base.items, chair, keep],
      rooms: base.rooms.map((r) =>
        r.id === hotel.id
          ? { ...r, blocks: { [`${spot.col},${spot.row}`]: { id: 'planks', hits: 0, hitAt: 0 } } }
          : r.id === farm.id
            ? { ...r, plants: { [`${fspot.col},${fspot.row}`]: { seed: 'turnip_seed', plantedAt: 0, readyAt: 9 } } }
            : r,
      ),
    };
    const r = readSave(JSON.stringify({ version: 26, savedAt: 9, state: old }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 26, doorsChanged: 3 });
    if (!r.ok) return;
    expect(r.state.items.find((i) => i.uid === uid)!.roomId).toBeNull();
    expect(r.state.items.find((i) => i.uid === uid + 1)!.roomId).toBe(hotel.id);
    expect(r.state.rooms.find((x) => x.id === hotel.id)!.blocks).toEqual({});
    expect(r.state.rooms.find((x) => x.id === farm.id)!.plants).toEqual({});
    expect(r.state.player.materials).toMatchObject({ planks: 1, turnip_seed: 1 });
    expect(r.state.ledger.some((e) => e.reason === 'door_spot')).toBe(true);
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false, doorsChanged: 0 });
    // A save with nothing on the spots changes nothing.
    const clean = readSave(JSON.stringify({ version: 26, savedAt: 9, state: base }));
    expect(clean).toMatchObject({ ok: true, doorsChanged: 0 });
    if (clean.ok) expect(clean.state).toEqual(base);
  });
});

describe('migrates a version 25 save (K2, casks) and the whole chain 24 -> 27 (G1)', () => {
  it('a v25 save without casks gets an empty list; a save with casks keeps them', () => {
    const base = oldNew();
    const { casks: _c, ...tavern } = base.tavern;
    const r = readSave(JSON.stringify({ version: 25, savedAt: 9, state: { ...base, tavern } }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 25 });
    if (!r.ok) return;
    expect(r.state.tavern.casks).toEqual([]);
    expect(r.state.items).toEqual(base.items);
    expect(MIGRATIONS[25]!(base)).toMatchObject({ tavern: { casks: base.tavern.casks } });
  });

  it('a v24 save (no Inn name, no casks) walks every step to the current version and reads clean again', () => {
    const base = oldNew();
    const { casks: _c, ...tavern } = base.tavern;
    const { innName: _n, ...player } = base.player;
    const r = readSave(JSON.stringify({ version: 24, savedAt: 9, state: { ...base, player, tavern } }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 24 });
    if (!r.ok) return;
    expect(r.state.player.innName).toBe('Your Tavern');
    expect(r.state.tavern.casks).toEqual([]);
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
  });
});

describe('migration 28 -> 29 (step G2: the hands-on pour)', () => {
  it('a mug in the hands gets perfect false; empty hands and other saves are untouched', () => {
    const state = oldNew();
    const holding = { ...state, tavern: { ...state.tavern, holding: { guestId: 1, item: 'root_ale' } } };
    const r = readSave(JSON.stringify({ version: 28, savedAt: 9, state: holding }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) expect(r.state.tavern.tray).toEqual([{ item: 'root_ale' }]);
    const e = readSave(JSON.stringify({ version: 28, savedAt: 9, state }));
    expect(e).toMatchObject({ ok: true, migrated: true });
    if (e.ok) expect(e.state.tavern.tray).toEqual([]);
  });
});

describe('migration 29 -> 30 (step SG4: plants on any block)', () => {
  const planted = () => {
    const base = oldNew();
    const farm = base.rooms.find((r) => r.kind === 'farm')!;
    const plants = {
      '2,2': { seed: 'turnip_seed', plantedAt: 10, readyAt: 130_010 },
      '3,2': { seed: 'gone_seed', plantedAt: 10, readyAt: 20 },
      '4,2': { seed: 'dirt_seed', with: 'nope_seed', plantedAt: 10, readyAt: 20 },
      '5,2': { seed: 'dirt_seed', with: 'clay_seed', plantedAt: 10, readyAt: 99 },
      '6,2': { seed: 'dirt_seed', plantedAt: 'x', readyAt: 20 },
    };
    return { ...base, rooms: base.rooms.map((r) => (r.id === farm.id ? { ...r, plants } : r)) } as unknown;
  };
  it('drops plants with an unknown seed or broken times and keeps the rest untouched', () => {
    const r = readSave(JSON.stringify({ version: 29, savedAt: 9, state: planted() }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    const farm = r.state.rooms.find((x) => x.kind === 'farm')!;
    expect(Object.keys(farm.plants).sort()).toEqual(['2,2', '5,2']);
    expect(farm.plants['5,2']).toEqual({ seed: 'dirt_seed', with: 'clay_seed', plantedAt: 10, readyAt: 99 });
  });
  it('a plant and a block in one cell is a valid state, and a new save does not migrate again', () => {
    const r = readSave(JSON.stringify({ version: 29, savedAt: 9, state: planted() }));
    if (!r.ok) throw new Error('load failed');
    const farm = r.state.rooms.find((x) => x.kind === 'farm')!;
    const both = { ...r.state, rooms: r.state.rooms.map((x) => (x.id === farm.id ? { ...x, blocks: { '2,2': { id: 'planks', hits: 0, hitAt: 0 } } } : x)) };
    expect(readSave(toSaveText(both as never, 9))).toMatchObject({ ok: true, migrated: false });
  });
});

describe('migration 30 -> 31 (step COD-1: the waiter tray)', () => {
  it('the mug in the hands (holding) becomes a one-mug tray; empty hands become an empty tray; a perfect pour stays perfect; holding is gone', () => {
    const state = oldNew();
    const { tray: _t, ...tavernNoTray } = state.tavern;
    const old = (holding: unknown) => ({ ...state, tavern: { ...tavernNoTray, holding } });
    const a = readSave(JSON.stringify({ version: 30, savedAt: 9, state: old({ guestId: -2, item: 'root_ale', perfect: true }) }));
    expect(a).toMatchObject({ ok: true, migrated: true });
    if (a.ok) {
      expect(a.state.tavern.tray).toEqual([{ item: 'root_ale', perfect: true }]);
      expect('holding' in a.state.tavern).toBe(false);
    }
    const b = readSave(JSON.stringify({ version: 30, savedAt: 9, state: old(null) }));
    if (b.ok) expect(b.state.tavern.tray).toEqual([]);
    expect(readSave(toSaveText(state, 9))).toMatchObject({ ok: true, migrated: false });
  });
});

describe('migration 31 -> 32 (step ST1: stacked blocks)', () => {
  it('every block of a version 31 save becomes a stack of one; nothing else changes', () => {
    const state = oldNew();
    const cell: BlockCell = { id: 'dirt', hits: 2, hitAt: 5 };
    const old = { ...state, rooms: state.rooms.map((r, i) => (i === 0 ? { ...r, blocks: { '3,4': cell, '5,6': { id: 'planks', hits: 0, hitAt: 0 } } } : r)) };
    const r = readSave(JSON.stringify({ version: 31, savedAt: 9, state: old }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) {
      expect(r.state.rooms[0]!.blocks['3,4']).toEqual([cell]);
      expect(r.state.rooms[0]!.blocks['5,6']).toEqual([{ id: 'planks', hits: 0, hitAt: 0 }]);
      expect(r.state.rooms[1]).toEqual(state.rooms[1]);
    }
    // A save that is already stacked (version 32) loads as it is.
    const stacked = { ...state, rooms: state.rooms.map((r, i) => (i === 0 ? { ...r, blocks: { '3,4': [cell, cell] } } : r)) };
    const again = readSave(toSaveText(stacked, 9));
    expect(again).toMatchObject({ ok: true, migrated: false });
    if (again.ok) expect(again.state.rooms[0]!.blocks['3,4']).toHaveLength(2);
  });
});
