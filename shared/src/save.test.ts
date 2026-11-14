import { describe, expect, it } from 'vitest';
import { readSave, saveKey, toSaveText } from './save.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { SAVE_VERSION } from './config.ts';

const state = applyChange(createNewPlayer(undefined, 1), { reason: 'debug', addFurniture: ['chair', 'rug'] }, 2)!;

describe('save files', () => {
  it('saving then loading gives an identical state', () => {
    const loaded = readSave(toSaveText(state, 3));
    expect(loaded).toEqual({ ok: true, state, version: SAVE_VERSION, migrated: false });
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
    expect(r.state.items.find((i) => i.typeId === 'counter')).toMatchObject({ x: 176, y: 88 });
  });

  it('migrates a version 4 save: square rooms, the old look as clothing, and no character creation', () => {
    const { playerCreated: _p, farm: _f, ...rest } = state;
    const v4 = {
      ...rest,
      rooms: rest.rooms.filter((r) => r.kind !== 'farm').map(({ shape: _s, ...r }) => r),
      look: { skin: 30, hair: 5, hairStyle: 0, shirt: 7, legs: 23, shoes: 6 },
      player: (({ unlockedClothing: _u, ...p }) => p)(rest.player),
    };
    const r = readSave(JSON.stringify({ version: 4, savedAt: 0, state: v4 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.rooms.map((x) => x.shape)).toEqual(['square', 'square_shop', 'farm']);
    expect(r.state.look).toEqual({ skin: 30, hair: 5, hairStyle: 'short', top: 'long_sleeve', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 });
    expect(r.state.player.unlockedClothing).toEqual([]);
    expect(r.state.playerCreated).toBe(true);
  });

  it('migrates a version 6 save (step 9b): a level 1 farm with empty plots, and the run gets a lunch box', () => {
    const { farm: _f, ...rest } = state;
    const v6 = {
      ...rest,
      rooms: rest.rooms.filter((r) => r.kind !== 'farm'),
      player: (({ farmRoomId: _id, ...p }) => p)(rest.player),
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
    });
    expect(r.state.player.bookOpenedAt).toBe(0);
    expect(r.state.player.bookRewards).toEqual([]);
  });
});
