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
    const { playerCreated: _p, ...rest } = state;
    const v4 = {
      ...rest,
      rooms: rest.rooms.map(({ shape: _s, ...r }) => r),
      look: { skin: 30, hair: 5, hairStyle: 0, shirt: 7, legs: 23, shoes: 6 },
      player: (({ unlockedClothing: _u, ...p }) => p)(rest.player),
    };
    const r = readSave(JSON.stringify({ version: 4, savedAt: 0, state: v4 }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (!r.ok) return;
    expect(r.state.rooms.map((x) => x.shape)).toEqual(['square', 'square_shop']);
    expect(r.state.look).toEqual({ skin: 30, hair: 5, hairStyle: 'short', top: 'long_sleeve', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 });
    expect(r.state.player.unlockedClothing).toEqual([]);
    expect(r.state.playerCreated).toBe(true);
  });
});

