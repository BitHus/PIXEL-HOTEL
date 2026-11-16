import { describe, expect, it } from 'vitest';
import {
  FOOD_TYPES, batchInputs, canCook, collectCook, cookMs, cookOf, cookReadyInMs, cookReady, maxBatchWith, returnOrphanCooks, startCook, stoves,
} from './cooking.ts';
import { COOK_MS, STOVE_BATCH_MAX, TAVERN_START_ITEMS } from './config.ts';
import { getFurnitureType, canPlace, roomBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { ROOM_SHAPES } from './room.ts';
import { readSave, toSaveText } from './save.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { MaterialId } from './types.ts';

const SEC = 1000;
const withGoods = (m: Partial<Record<MaterialId, number>>, s: GameState = createNewPlayer(undefined, 0)): GameState => applyChange(s, { reason: 'debug', materials: m }, 0)!;
const stoveUid = (s: GameState): number => stoves(s.items, s.tavern.roomId)[0]!.uid;
const food = (id: string) => FOOD_TYPES.find((f) => f.id === id)!;

/** A second stove, placed on a free spot of the start tavern (the square shop). */
function withSecondStove(s: GameState): GameState {
  const gift = applyChange(s, { reason: 'debug', addFurniture: ['stove'] }, 0)!;
  const added = gift.items.at(-1)!;
  return { ...gift, items: gift.items.map((i) => (i.uid === added.uid ? { ...i, roomId: s.tavern.roomId, x: 304, y: 288, facing: 'down' as const } : i)) };
}

describe('the recipes (section 10b, step K1)', () => {
  it('has the eight recipes from food.json, each with a cook time', () => {
    expect(FOOD_TYPES.map((f) => [f.id, f.inputs, f.effect])).toEqual([
      ['roasted_turnip', { turnip: 1 }, { kind: 'heal', amount: 8 }],
      ['potato_stew', { potato: 2, turnip: 1 }, { kind: 'heal', amount: 15 }],
      ['carrot_soup', { carrot: 2, potato: 1 }, { kind: 'attack', amount: 1 }],
      ['pumpkin_pie', { pumpkin: 1, carrot: 1 }, { kind: 'max_hp', amount: 10 }],
      ['glowcap_broth', { glowcap: 1, potato: 1 }, { kind: 'attack_cooldown', amount: 300 }],
      ['grilled_perch', { pebble_perch: 1, turnip: 1 }, { kind: 'heal', amount: 12 }],
      ['carp_stew', { lantern_carp: 1, potato: 1 }, { kind: 'attack', amount: 1 }],
      ['eel_pie', { moonscale_eel: 1, pumpkin: 1 }, { kind: 'max_hp', amount: 10 }],
    ]);
  });

  it('the first dish is ready within 30 s, the stew in 1 min, nothing takes more than 5 min', () => {
    expect(cookMs(food('roasted_turnip'))).toBe(20 * SEC);
    expect(cookMs(food('potato_stew'))).toBe(60 * SEC);
    expect(Math.min(...FOOD_TYPES.map(cookMs))).toBeLessThanOrEqual(30 * SEC);
    expect(Math.max(...FOOD_TYPES.map(cookMs))).toBeLessThanOrEqual(5 * 60 * SEC);
    // Rarer dishes take longer (the common ones are the quick ones).
    expect(cookMs(food('eel_pie'))).toBeGreaterThan(cookMs(food('potato_stew')));
    expect(STOVE_BATCH_MAX).toBe(4);
  });

  it('a recipe without its own cookMs takes the default of its rank', () => {
    const { cookMs: _own, ...bare } = food('carrot_soup');
    expect(cookMs(bare)).toBe(COOK_MS.rare);
  });

});

describe('the stove', () => {
  it('is a tavern furniture in the catalog: a cell, a light, common, placeIn shop', () => {
    const t = getFurnitureType('stove');
    expect(t).toMatchObject({ cooks: true, w: 32, d: 32, placeIn: 'shop', rank: 'common', inCatalog: true, blocks: true });
    expect(t.light?.radius).toBeGreaterThan(0);
    expect(t.icon.shape).toBe('stove');
  });

  it('a new game starts with one stove in the tavern, near the bar, on every shop shape', () => {
    for (const shape of ROOM_SHAPES.filter((r) => r.shopStart)) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape.id }, 0);
      const list = stoves(s.items, s.tavern.roomId);
      expect(list, shape.id).toHaveLength(1);
      const counter = s.items.find((i) => i.typeId === 'counter')!;
      expect(list[0]!.y, shape.id).toBe(counter.y);
      expect(Math.abs(list[0]!.x - counter.x), shape.id).toBeLessThanOrEqual(160); // COD-1 (f): the kitchen is a few cells from the bar, not on top of it
      // It stands where it may stand, with every other start item (and the counter's staff spot stays reachable).
      const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
      const others = s.items.filter((i) => i.uid !== list[0]!.uid);
      expect(canPlace(room, others, getFurnitureType('stove'), list[0]!.x, list[0]!.y, 'down'), shape.id).toBe(true);
      expect(roomBlockers(room, s.items).length).toBeGreaterThan(0);
    }
    expect(TAVERN_START_ITEMS.map((i) => i.typeId)).toContain('stove');
  });
});

describe('cooking in real time', () => {
  it('needs the inputs of every dish in the batch, a free stove in the tavern and a batch of 1 to 4', () => {
    const s = withGoods({ potato: 2 });
    const uid = stoveUid(s);
    expect(canCook(food('potato_stew'), s)).toBe(false);
    expect(startCook(s, uid, 'potato_stew', 1, 1)).toBeNull(); // no turnip
    const rich = withGoods({ potato: 20, turnip: 20 });
    expect(startCook(rich, uid, 'potato_stew', 0, 1)).toBeNull();
    expect(startCook(rich, uid, 'potato_stew', 5, 1)).toBeNull();
    expect(startCook(rich, uid, 'potato_stew', 1.5, 1)).toBeNull();
    expect(startCook(rich, uid, 'no_such_dish', 1, 1)).toBeNull();
    expect(startCook(rich, 9999, 'potato_stew', 1, 1)).toBeNull(); // not a stove of the tavern
    expect(startCook(rich, rich.items.find((i) => i.typeId === 'counter')!.uid, 'potato_stew', 1, 1)).toBeNull();
    // 4 stews need 8 potatoes and 4 turnips: fine here, short with 7 potatoes.
    expect(startCook(rich, uid, 'potato_stew', 4, 1)).not.toBeNull();
    expect(startCook(withGoods({ potato: 7, turnip: 4 }), uid, 'potato_stew', 4, 1)).toBeNull();
    expect(batchInputs(food('potato_stew'), 4)).toEqual({ potato: 8, turnip: 4 });
    expect(maxBatchWith({ potato: 7, turnip: 4 }, food('potato_stew'))).toBe(3);
    expect(maxBatchWith({ potato: 100, turnip: 100 }, food('potato_stew'))).toBe(STOVE_BATCH_MAX);
    expect(maxBatchWith({}, food('potato_stew'))).toBe(0);
  });

  it('the crops go in at once (ledger), the dishes come out when the time is up, and the ledger adds up', () => {
    const s0 = withGoods({ potato: 5, turnip: 3 });
    const uid = stoveUid(s0);
    const cooking = startCook(s0, uid, 'potato_stew', 2, 10_000)!;
    expect(cooking.player.materials).toMatchObject({ potato: 1, turnip: 1 });
    expect(cooking.player.materials.potato_stew).toBeUndefined();
    expect(cooking.ledger.at(-1)).toMatchObject({ reason: 'cook', materials: { potato: -4, turnip: -2 } });
    const cook = cookOf(cooking.tavern.cooks, uid)!;
    expect(cook).toEqual({ stoveUid: uid, food: 'potato_stew', qty: 2, readyAt: 10_000 + 60 * SEC });
    expect(cookReady(cook, 10_000 + 60 * SEC - 1)).toBe(false);
    expect(cookReadyInMs(cook, 10_000 + 20 * SEC)).toBe(40 * SEC);
    // Not a millisecond too early; the stove is busy meanwhile.
    expect(collectCook(cooking, uid, 10_000 + 60 * SEC - 1)).toBeNull();
    expect(startCook(cooking, uid, 'roasted_turnip', 1, 11_000)).toBeNull();
    const got = collectCook(cooking, uid, 10_000 + 60 * SEC)!;
    expect(got).toMatchObject({ food: 'potato_stew', qty: 2 });
    expect(got.state.player.materials.potato_stew).toBe(2);
    expect(got.state.tavern.cooks).toEqual([]);
    expect(got.state.ledger.at(-1)).toMatchObject({ reason: 'cook', materials: { potato_stew: 2 } });
    expect(got.state.player.seen.potato_stew?.count).toBe(2);
    expect(ledgerMaterials(got.state)).toEqual(got.state.player.materials);
    expect(ledgerGold(got.state)).toBe(got.state.player.wallet.gold);
    // Collected once only; the stove is free for the next batch.
    expect(collectCook(got.state, uid, 99_999_999)).toBeNull();
    expect(startCook(got.state, uid, 'roasted_turnip', 1, 200_000)).not.toBeNull();
  });

  it('nothing is collected by itself: time passing changes no bag and no ledger', () => {
    const s0 = withGoods({ turnip: 3 });
    const uid = stoveUid(s0);
    const cooking = startCook(s0, uid, 'roasted_turnip', 3, 0)!;
    // An hour later (a closed game) the state is the same until the player collects.
    expect(cooking.player.materials.roasted_turnip).toBeUndefined();
    expect(cookReady(cookOf(cooking.tavern.cooks, uid)!, 3_600_000)).toBe(true);
    expect(collectCook(cooking, uid, 3_600_000)!.state.player.materials.roasted_turnip).toBe(3);
  });

  it('goes on across a save and a reload (the game was closed meanwhile)', () => {
    const s0 = withGoods({ turnip: 1 });
    const uid = stoveUid(s0);
    const cooking = startCook(s0, uid, 'roasted_turnip', 1, 5_000)!;
    const loaded = readSave(toSaveText(cooking, 6_000));
    expect(loaded).toMatchObject({ ok: true, migrated: false });
    if (!loaded.ok) return;
    expect(loaded.state.tavern.cooks).toEqual(cooking.tavern.cooks);
    expect(collectCook(loaded.state, uid, 5_000 + 20 * SEC - 1)).toBeNull();
    expect(collectCook(loaded.state, uid, 5_000 + 8 * 3_600_000)!.state.player.materials.roasted_turnip).toBe(1);
  });

  it('two stoves cook two batches in parallel, each on its own time', () => {
    const s0 = withGoods({ turnip: 6, potato: 4 }, withSecondStove(createNewPlayer(undefined, 0)));
    const [a, b] = stoves(s0.items, s0.tavern.roomId).map((i) => i.uid) as [number, number];
    expect(a).not.toBe(b);
    let s = startCook(s0, a, 'roasted_turnip', 4, 1_000)!;
    s = startCook(s, b, 'potato_stew', 1, 1_000)!;
    expect(s.tavern.cooks).toHaveLength(2);
    // The roast (20 s) is ready while the stew (60 s) is not.
    const r = collectCook(s, a, 1_000 + 20 * SEC)!;
    expect(r).toMatchObject({ food: 'roasted_turnip', qty: 4 });
    expect(collectCook(r.state, b, 1_000 + 20 * SEC)).toBeNull();
    expect(r.state.tavern.cooks.map((c) => c.stoveUid)).toEqual([b]);
    expect(collectCook(r.state, b, 1_000 + 60 * SEC)!.state.player.materials).toMatchObject({ roasted_turnip: 4, potato_stew: 1 });
  });

  it('a stove picked up into the bag keeps its batch but cannot be collected until it stands in the tavern again', () => {
    const s0 = withGoods({ turnip: 1 });
    const uid = stoveUid(s0);
    const cooking = startCook(s0, uid, 'roasted_turnip', 1, 0)!;
    const inBag = { ...cooking, items: cooking.items.map((i) => (i.uid === uid ? { ...i, roomId: null } : i)) };
    expect(returnOrphanCooks(inBag, 1).tavern.cooks).toHaveLength(1);
    expect(collectCook(inBag, uid, 60 * SEC)).toBeNull();
  });

  it('a stove that is gone gives its crops back, once', () => {
    const s0 = withGoods({ potato: 4, turnip: 2 });
    const uid = stoveUid(s0);
    const cooking = startCook(s0, uid, 'potato_stew', 2, 0)!;
    expect(cooking.player.materials.potato).toBeUndefined();
    const gone = returnOrphanCooks({ ...cooking, items: cooking.items.filter((i) => i.uid !== uid) }, 5)!;
    expect(gone.player.materials).toMatchObject({ potato: 4, turnip: 2 });
    expect(gone.tavern.cooks).toEqual([]);
    expect(ledgerMaterials(gone)).toEqual(gone.player.materials);
    expect(returnOrphanCooks(gone, 6).player.materials).toEqual(gone.player.materials);
  });
});
