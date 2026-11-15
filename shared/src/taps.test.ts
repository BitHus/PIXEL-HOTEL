// Step T1: the taps (load, unload, the menu rule, the pour), the bar's register and tap stand, and the 24 -> 25 migration.

import { describe, expect, it } from 'vitest';
import { POUR_MS, TAP_CAP, TAP_SLOTS } from './config.ts';
import { tavernAppeal } from './appeal.ts';
import { getFurnitureType, planPlacement } from './furniture.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { readSave, toSaveText } from './save.ts';
import { seededRng } from './rng.ts';
import { activeTaps, drinkStock, loadTap, pourMug, refundMug, returnOrphanTaps, tapMugs, tapViews, unloadTap } from './taps.ts';
import { cancelServe, menuOffers, menuRows, nextQueuedOrder, openOrders, pickUpOrder, requestServe } from './tavern.ts';
import { runTavern, stock, withAle } from './tavernTest.ts';
import { ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';

/** Steps the tavern in 10 s chunks until a guest has an open order (and returns the time). */
function untilOrder(s: GameState, rng: ReturnType<typeof seededRng>): { s: GameState; t: number } {
  let t = 0;
  while (openOrders(s.tavern).length === 0 && t < 20 * 60_000) {
    s = runTavern(s, t, 10_000, rng, true);
    t += 10_000;
  }
  return { s, t };
}
const stand = (s: GameState) => s.items.find((i) => i.typeId === 'tap_stand')!;
const withBag = (s: GameState, m: Record<string, number>): GameState => applyChange(s, { reason: 'debug', materials: m }, 1)!;
/** A new game with empty taps (the 7 mugs are back in the bag). */
const empty = (): GameState => {
  const s = createNewPlayer(undefined, 0);
  return unloadTap(s, stand(s).uid, 0, 1)!;
};

describe('the bar (step T1)', () => {
  it('the counter is a surface; the register and the tap stand sit on it, on whole cells', () => {
    expect(getFurnitureType('counter').surface).toBe(true);
    const s = createNewPlayer(undefined, 0);
    const bar = s.items.find((i) => i.typeId === 'counter')!;
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    for (const id of ['register', 'tap_stand']) {
      const item = s.items.find((i) => i.typeId === id)!;
      expect(item.onItemUid).toBe(bar.uid);
      const others = s.items.filter((i) => i.uid !== item.uid);
      expect(planPlacement(room, others, getFurnitureType(id), item.x, item.y, 'down')).toMatchObject({ ok: true, onItemUid: bar.uid, x: item.x, y: item.y });
    }
    expect(getFurnitureType('tap_stand').taps).toBe(true);
    expect(getFurnitureType('register').onSurface).toBe(true);
    expect(s.items.filter((i) => i.onItemUid !== null).map((i) => i.typeId).sort()).toEqual(['register', 'tap_stand']);
  });
  it('tap stands and the register add no appeal (an old save keeps its guest rate)', () => {
    expect(getFurnitureType('tap_stand').appeal).toBe(0);
    expect(getFurnitureType('register').appeal).toBe(0);
  });
});

describe('taps: load and unload', () => {
  it('moves mugs of one drink from the bag into a tap and back, through the ledger', () => {
    let s = withBag(empty(), { carrot_cider: 5 });
    const u = stand(s).uid;
    s = loadTap(s, u, 1, 'carrot_cider', 4, 5)!;
    expect(s.player.materials.carrot_cider).toBe(1);
    expect(s.tavern.taps).toContainEqual({ standUid: u, slot: 1, drink: 'carrot_cider', mugs: 4 });
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'tap_load', materials: { carrot_cider: -4 } });
    s = unloadTap(s, u, 1, 6, 3)!;
    expect(s.tavern.taps.find((t) => t.slot === 1)).toMatchObject({ mugs: 1 });
    expect(s.player.materials.carrot_cider).toBe(4);
    s = unloadTap(s, u, 1, 7)!;
    expect(s.tavern.taps.find((t) => t.slot === 1)).toBeUndefined();
    expect(s.player.materials.carrot_cider).toBe(5);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    expect(unloadTap(s, u, 1, 8)).toBeNull(); // empty
  });
  it('refuses another drink on a tap, more than TAP_CAP, mugs the bag lacks, a bad slot, a dish, an unplaced stand', () => {
    let s = withBag(empty(), { carrot_cider: 20, root_ale: 10, roasted_turnip: 2 });
    const u = stand(s).uid;
    expect(s.player.materials.root_ale).toBe(17); // 7 from the empty() start + 10
    s = loadTap(s, u, 0, 'root_ale', 5, 1)!;
    expect(loadTap(s, u, 0, 'carrot_cider', 1, 1)).toBeNull(); // one drink per tap
    expect(loadTap(s, u, 0, 'root_ale', TAP_CAP - 4, 1)).toBeNull(); // would pass the cap
    expect(loadTap(s, u, 0, 'root_ale', TAP_CAP - 5, 1)).not.toBeNull();
    expect(loadTap(s, u, 0, 'root_ale', TAP_CAP - 5 + 1, 1)).toBeNull();
    expect(loadTap(s, u, 1, 'carrot_cider', 21, 1)).toBeNull(); // the bag has 20
    expect(loadTap(s, u, TAP_SLOTS, 'carrot_cider', 1, 1)).toBeNull();
    expect(loadTap(s, u, 1, 'roasted_turnip', 1, 1)).toBeNull();
    expect(loadTap(s, u, 1, 'carrot_cider', 0, 1)).toBeNull();
    expect(loadTap(s, 9999, 1, 'carrot_cider', 1, 1)).toBeNull();
    const bagged = { ...s, items: s.items.map((i) => (i.uid === u ? { ...i, roomId: null, onItemUid: null } : i)) };
    expect(loadTap(bagged, u, 1, 'carrot_cider', 1, 1)).toBeNull(); // the stand is in the bag
  });
  it('a stand in the bag keeps its mugs but they do not serve; a stand that was sold gives them back', () => {
    const s = createNewPlayer(undefined, 0);
    const u = stand(s).uid;
    const bagged = { ...s, items: s.items.map((i) => (i.uid === u ? { ...i, roomId: null, onItemUid: null } : i)) };
    expect(bagged.tavern.taps[0]!.mugs).toBe(7);
    expect(activeTaps(bagged)).toEqual([]);
    expect(menuOffers(bagged).some((o) => o.id === 'root_ale')).toBe(false);
    expect(returnOrphanTaps(bagged, 2).tavern.taps).toHaveLength(1);
    const sold = returnOrphanTaps({ ...bagged, items: bagged.items.filter((i) => i.uid !== u) }, 2);
    expect(sold.tavern.taps).toEqual([]);
    expect(sold.player.materials.root_ale).toBe(7);
  });
  it('tapViews lists TAP_SLOTS taps per placed stand, empty ones too', () => {
    const v = tapViews(createNewPlayer(undefined, 0));
    expect(v).toEqual([
      { standUid: expect.any(Number), slot: 0, drink: 'root_ale', mugs: 7, cap: TAP_CAP },
      { standUid: expect.any(Number), slot: 1, drink: null, mugs: 0, cap: TAP_CAP },
    ]);
  });
});

describe('the menu rule: a drink is on the menu only while a tap holds a mug', () => {
  it('mugs in the bag are not offered, mugs on a tap are', () => {
    let s = empty();
    s = { ...s, tavern: { ...s.tavern, menu: { root_ale: { on: true, price: 9 } } } };
    expect(menuOffers(s).some((o) => o.id === 'root_ale')).toBe(false);
    expect(menuRows(s).find((r) => r.id === 'root_ale')).toMatchObject({ stock: 0, inBag: 7, onTap: 0, on: true });
    s = loadTap(s, stand(s).uid, 0, 'root_ale', 7, 1)!;
    expect(menuOffers(s).find((o) => o.id === 'root_ale')).toMatchObject({ stock: 7 });
    expect(menuRows(s).find((r) => r.id === 'root_ale')).toMatchObject({ stock: 7, inBag: 0, onTap: 7 });
  });
  it('dishes still come from the bag', () => {
    const s = withBag(empty(), { roasted_turnip: 2 });
    expect(menuOffers(s).find((o) => o.id === 'roasted_turnip')).toMatchObject({ stock: 2 });
  });
  it('mugs an open order has claimed are not offered again', () => {
    const rng = seededRng(3);
    const base = withAle();
    let s = stock({ ...base, tavern: { ...base.tavern, taps: [] } }, 'root_ale', 1); // ONE mug
    s = runTavern(untilOrder(s, rng).s, 0, 0, rng, true);
    s = runTavern(s, 0, 3 * 60_000, rng, true);
    expect(openOrders(s.tavern)).toHaveLength(1); // never two orders for one mug
    expect(drinkStock(s, 'root_ale')).toBe(0);
    expect(tapMugs(s, 'root_ale')).toBe(1); // nothing was poured yet and nothing left the bag
  });
});

describe('the pour', () => {
  it('pourMug takes one mug off the tap that has the drink; the last one empties the tap', () => {
    let s = stock(empty(), 'root_ale', 2);
    const a = pourMug(s, 'root_ale')!;
    expect(a.state.tavern.taps[0]!.mugs).toBe(1);
    s = pourMug(a.state, 'root_ale')!.state;
    expect(s.tavern.taps).toEqual([]);
    expect(pourMug(s, 'root_ale')).toBeNull();
    expect(pourMug(a.state, 'carrot_cider')).toBeNull();
    expect(POUR_MS).toBeGreaterThan(0);
  });
  it('picking up a drink order pours it (the tap goes down, the bag stays); with an empty tap the order stays open and nothing is held', () => {
    const rng = seededRng(5);
    let s = untilOrder(withAle(), rng).s;
    const guest = openOrders(s.tavern)[0]!;
    s = requestServe(s, guest.id)!;
    expect(nextQueuedOrder(s)).toEqual({ guestId: guest.id, item: 'root_ale' });
    const before = tapMugs(s, 'root_ale');
    const bag = s.player.materials.root_ale;
    const picked = pickUpOrder(s)!;
    expect(picked.poured).toMatchObject({ slot: 0 });
    expect(tapMugs(picked.state, 'root_ale')).toBe(before - 1);
    expect(picked.state.player.materials.root_ale).toBe(bag);
    expect(picked.state.tavern.holding).toEqual({ guestId: guest.id, item: 'root_ale' });
    // The player unloaded the tap meanwhile: nothing to pour.
    const dry = { ...s, tavern: { ...s.tavern, taps: [] } };
    expect(pickUpOrder(dry)).toBeNull();
    expect(openOrders(dry.tavern)).toHaveLength(openOrders(s.tavern).length);
  });
  it('a poured mug that is not served goes back on the tap (or a free tap, else the bag)', () => {
    const rng = seededRng(5);
    const s = untilOrder(withAle(), rng).s;
    const guest = openOrders(s.tavern)[0]!;
    const before = tapMugs(s, 'root_ale');
    const picked = pickUpOrder(requestServe(s, guest.id)!)!;
    const back = cancelServe(picked.state, 9);
    expect(back.tavern.holding).toBeNull();
    expect(tapMugs(back, 'root_ale')).toBe(before);
    // No stand at all: the mug goes into the bag.
    const noStand = { ...picked.state, items: picked.state.items.filter((i) => i.typeId !== 'tap_stand') };
    expect(refundMug(noStand, 'root_ale', 9).player.materials.root_ale).toBe((noStand.player.materials.root_ale ?? 0) + 1);
  });
  it('a guest who leaves unserved gives their poured mug back', () => {
    const rng = seededRng(15);
    const o = untilOrder(withAle(), rng);
    let s = o.s;
    const guest = openOrders(s.tavern)[0]!;
    const total = tapMugs(s, 'root_ale');
    s = pickUpOrder(requestServe(s, guest.id)!)!.state;
    s = runTavern(s, o.t, 3 * 60_000, rng, true);
    expect(s.tavern.holding).toBeNull();
    expect(tapMugs(s, 'root_ale')).toBe(total); // the mug in the hands is back on the tap
    expect(s.player.materials).toEqual(ledgerMaterials(s));
  });
});

describe('migration 24 -> 25 (step T1)', () => {
  /** A v24 save: no taps, no tapsIntroSeen, no register and no tap stand; the bar as it was. */
  function v24(extra?: (s: GameState) => GameState): { version: number; savedAt: number; state: GameState } {
    const s0 = createNewPlayer(undefined, 5);
    const { taps: _t, tapsIntroSeen: _i, ...tavern } = s0.tavern;
    const items = s0.items.filter((i) => i.typeId !== 'register' && i.typeId !== 'tap_stand');
    const ale = applyChange({ ...s0, items, tavern: tavern as never }, { reason: 'debug', materials: { root_ale: 4 } }, 5)!;
    return { version: 24, savedAt: 0, state: extra ? extra(ale) : ale };
  }

  it('puts a tap stand and a register ON the bar, empty taps, the drinks stay in the bag, the guest rate does not change', () => {
    const old = v24();
    const r = readSave(JSON.stringify(old));
    expect(r).toMatchObject({ ok: true, version: 24, migrated: true });
    if (!r.ok) return;
    const bar = r.state.items.find((i) => i.typeId === 'counter')!;
    const riders = r.state.items.filter((i) => i.onItemUid === bar.uid);
    expect(riders.map((i) => i.typeId).sort()).toEqual(['register', 'tap_stand']);
    expect(riders.every((i) => i.roomId === r.state.tavern.roomId)).toBe(true);
    expect(r.state.tavern.taps).toEqual([]);
    expect(r.state.tavern.tapsIntroSeen).toBe(false);
    expect(r.state.player.materials.root_ale).toBe(4); // stock stays in the bag
    expect(menuOffers(r.state).some((o) => o.id === 'root_ale')).toBe(false); // until a tap holds it
    const room = (s: GameState) => s.rooms.find((x) => x.id === s.tavern.roomId)!;
    expect(tavernAppeal(room(r.state), r.state.items)).toBe(tavernAppeal(room(old.state), old.state.items));
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
  });

  it('a bar with no free cell: the pieces go to the bag (the toast flag is false)', () => {
    const full = v24((s) => {
      const bar = s.items.find((i) => i.typeId === 'counter')!;
      const jug = (uid: number, x: number) => ({ uid, typeId: 'clay_jug', ownerId: 1, roomId: s.tavern.roomId, x, y: bar.y, facing: 'down' as const, onItemUid: bar.uid });
      return { ...s, items: [...s.items, jug(900, bar.x - 32), jug(901, bar.x), jug(902, bar.x + 32)], nextUid: 903 };
    });
    const r = readSave(JSON.stringify(full));
    if (!r.ok) throw new Error('not ok');
    for (const id of ['register', 'tap_stand']) expect(r.state.items.find((i) => i.typeId === id)).toMatchObject({ roomId: null, onItemUid: null });
    expect(r.state.tavern.tapsIntroSeen).toBe(false);
  });
});
