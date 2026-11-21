// 3e FOOD STASH: dishes are served from the serving hatch, one click each way, the menu reads the stash.
import { describe, expect, it } from 'vitest';
import { SHOP_TICK_MS, STASH_CAP, STASH_SLOTS } from './config.ts';
import { footprintRect, getFurnitureType, pickUpItem, standPointFor } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { stepTavern } from './guests.ts';
import { kitchenZone, rectInZone } from './kitchen.ts';
import { applyChange } from './ledger.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { shapesFor } from './room.ts';
import {
  addToStash, bagDishes, loadStash, platesInStash, returnOrphanStash, stashCards, stashPieces, stashStockFor, stashTarget, takePlate, unloadStash,
} from './stash.ts';
import { unloadTap } from './taps.ts';
import { menuEntry, menuOffers, openOrders, pourOrder, requestServe, serveStops, setMenu } from './tavern.ts';
import { tavernWorld } from './tavernTest.ts';

const fresh = (): GameState => createNewPlayer(undefined, 0);
const give = (s: GameState, m: Record<string, number>): GameState => applyChange(s, { reason: 'debug', materials: m }, 0)!;
const hatchOf = (s: GameState) => stashPieces(s.items, s.tavern.roomId)[0]!;
/** Only dishes on the menu: the start ale goes back to the bag, so every guest orders the dish. */
const dishOnly = (s: GameState): GameState => {
  const tap = s.tavern.taps[0];
  return tap ? unloadTap(s, tap.standUid, tap.slot, 'all', 0)! : s;
};
function untilOrder(s: GameState, seed = 4): GameState {
  const rng = seededRng(seed);
  for (let t = SHOP_TICK_MS; t <= 10 * 60_000; t += SHOP_TICK_MS) {
    s = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t).state;
    if (openOrders(s.tavern).length > 0) return s;
  }
  throw new Error('no order');
}

describe('the food stash piece (3e)', () => {
  it('a new game has ONE serving hatch inside the kitchen annex on every tavern shape, with an empty stash', () => {
    expect(getFurnitureType('serving_hatch').stash).toBe(true);
    for (const shape of shapesFor('shop')) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape.id }, 0);
      const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
      const hatches = stashPieces(s.items, room.id);
      expect(hatches, shape.id).toHaveLength(1);
      expect(rectInZone(kitchenZone(room), footprintRect(hatches[0]!, getFurnitureType('serving_hatch'))), shape.id).toBe(true);
      expect(s.tavern.stash).toEqual([]);
    }
    expect([STASH_SLOTS, STASH_CAP]).toEqual([4, 6]);
  });
});

describe('one click each way (owner 19 Nov)', () => {
  it('a dish from the bag goes into the first empty slot, as many as fit; the same dish tops up its slot; another dish takes the next slot', () => {
    let s = give(fresh(), { roasted_turnip: 8, potato_stew: 2 });
    const r = addToStash(s, 'roasted_turnip', 5)!;
    expect(r).toMatchObject({ slot: 0, moved: STASH_CAP });
    s = r.state;
    expect(s.player.materials.roasted_turnip).toBe(2);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'stash' });
    // slot 0 is full: the rest of the turnips start slot 1
    expect(addToStash(s, 'roasted_turnip', 5)).toMatchObject({ slot: 1, moved: 2 });
    s = addToStash(s, 'roasted_turnip', 5)!.state;
    s = addToStash(s, 'potato_stew', 5)!.state;
    expect(stashCards([hatchOf(s).uid], s.tavern.stash).map((c) => [c.dish, c.plates])).toEqual([['roasted_turnip', 6], ['roasted_turnip', 2], ['potato_stew', 2], [null, 0]]);
    expect(addToStash(s, 'roasted_turnip', 5)).toBeNull(); // none left in the bag
    expect(bagDishes(s.player.materials)).toEqual([]);
  });

  it('a click on a slot gives all its plates back; bad loads are refused', () => {
    let s = give(fresh(), { roasted_turnip: 3, turnip: 2 });
    const uid = hatchOf(s).uid;
    expect(loadStash(s, uid, 0, 'turnip', 1, 0)).toBeNull(); // a crop is no dish
    expect(loadStash(s, uid, STASH_SLOTS, 'roasted_turnip', 1, 0)).toBeNull();
    expect(loadStash(s, 999, 0, 'roasted_turnip', 1, 0)).toBeNull();
    expect(loadStash(s, uid, 0, 'roasted_turnip', 4, 0)).toBeNull(); // only 3 in the bag
    s = loadStash(s, uid, 0, 'roasted_turnip', 3, 0)!;
    expect(loadStash(give(s, { potato_stew: 1 }), uid, 0, 'potato_stew', 1, 0)).toBeNull(); // one dish per slot
    expect(unloadStash(s, uid, 1, 'all', 0)).toBeNull(); // an empty slot
    s = unloadStash(s, uid, 0, 'all', 0)!;
    expect(s.tavern.stash).toEqual([]);
    expect(s.player.materials.roasted_turnip).toBe(3);
  });

  it('loading a dish with no menu choice puts it ON the menu; a dish the player switched off stays off', () => {
    let s = give({ ...fresh(), tavern: { ...fresh().tavern, menu: {} } }, { potato_stew: 2, roasted_turnip: 2 });
    expect(menuEntry(s.tavern, 'potato_stew').on).toBe(false);
    s = addToStash(s, 'potato_stew', 0)!.state;
    expect(menuEntry(s.tavern, 'potato_stew').on).toBe(true);
    s = setMenu(s, 'roasted_turnip', { on: false })!;
    s = addToStash(s, 'roasted_turnip', 0)!.state;
    expect(menuEntry(s.tavern, 'roasted_turnip').on).toBe(false);
    expect(menuOffers(s).map((o) => o.id).filter((id) => id !== 'root_ale')).toEqual(['potato_stew']);
  });

  it('no stash piece in the tavern: nothing can be loaded', () => {
    const s0 = give(fresh(), { roasted_turnip: 2 });
    const s = { ...s0, items: pickUpItem(s0.items, hatchOf(s0).uid) };
    expect(stashTarget(s, 'roasted_turnip')).toBeNull();
    expect(addToStash(s, 'roasted_turnip', 0)).toBeNull();
  });
});

describe('the menu and serving read the stash', () => {
  it('a dish is offered only while the stash holds a plate; an open order reserves one, the serve takes it from the stash, never from the bag', () => {
    let s = dishOnly(give(fresh(), { roasted_turnip: 3 }));
    expect(menuOffers(s)).toEqual([]);
    s = loadStash(s, hatchOf(s).uid, 0, 'roasted_turnip', 1, 0)!;
    expect(menuOffers(s).map((o) => [o.id, o.stock])).toEqual([['roasted_turnip', 1]]);
    s = untilOrder(s);
    const g = openOrders(s.tavern)[0]!;
    expect(g.order!.item).toBe('roasted_turnip');
    expect(stashStockFor(s.tavern, 'roasted_turnip')).toBe(0); // spoken for
    expect(menuOffers(s)).toEqual([]);
    expect(s.player.materials.roasted_turnip).toBe(2); // the order took nothing
    // The avatar fetches the plate at the hatch.
    const stops = serveStops(s, g.id)!;
    expect(stops.bar).toEqual(standPointFor(hatchOf(s), getFurnitureType('serving_hatch')));
    const p = pourOrder(requestServe(s, g.id)!)!;
    expect(p.empty).toBe(false);
    if (p.empty) return;
    expect(p.stash).toEqual({ pieceUid: hatchOf(s).uid, slot: 0 });
    expect(platesInStash(p.state.tavern.stash, 'roasted_turnip')).toBe(0);
    expect(p.state.player.materials.roasted_turnip).toBe(2);
    expect(p.state.tavern.tray.map((m) => m.item)).toEqual(['roasted_turnip']);
  });

  it('the stash ran empty before the fetch: the result is empty and the order stays open', () => {
    let s = dishOnly(give(fresh(), { roasted_turnip: 1 }));
    s = addToStash(s, 'roasted_turnip', 0)!.state;
    s = untilOrder(s);
    const g = openOrders(s.tavern)[0]!;
    s = unloadStash(s, hatchOf(s).uid, 0, 'all', 0)!;
    const p = pourOrder(requestServe(s, g.id)!)!;
    expect(p.empty).toBe(true);
    expect(openOrders(p.state.tavern).map((x) => x.id)).toContain(g.id);
  });

  it('takePlate takes one and says when the slot ran dry', () => {
    const stash = [{ pieceUid: 1, slot: 0, dish: 'roasted_turnip' as const, plates: 2 }];
    const a = takePlate(stash, 'roasted_turnip')!;
    expect([a.stash[0]!.plates, a.ranDry]).toEqual([1, false]);
    const b = takePlate(a.stash, 'roasted_turnip')!;
    expect([b.stash, b.ranDry]).toEqual([[], true]);
    expect(takePlate(b.stash, 'roasted_turnip')).toBeNull();
  });

  it('a hatch picked up gives its plates back to the bag', () => {
    let s = give(fresh(), { roasted_turnip: 4 });
    s = addToStash(s, 'roasted_turnip', 0)!.state;
    s = returnOrphanStash({ ...s, items: pickUpItem(s.items, hatchOf(s).uid) }, 0);
    expect(s.tavern.stash).toEqual([]);
    expect(s.player.materials.roasted_turnip).toBe(4);
    expect(s.tavern.lastLoaded ?? {}).toEqual({});
  });
});
