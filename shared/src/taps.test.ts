import { save41Start } from './tavernTest.ts';
import { describe, expect, it } from 'vitest';
import { TAP_CAP, TAP_SLOTS, TAVERN_START_RIDERS } from './config.ts';
import { footprintRect, getFurnitureType, planPlacement, snapToSurface, canPlace, ridersOf } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { stepTavern } from './guests.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { loadRoom, loadTap, mugsOnTaps, returnOrphanTaps, stockFor, tapCards, tapFor, unloadTap, tapStands, pourPoint, barOf, type Tap } from './taps.ts';
import { menuOffers, menuRows, nextOrder, openOrders, pourOrder, requestServe, serveStops } from './tavern.ts';
import { runTavern, serveAll, tavernWorld, withAle, withLongTable } from './tavernTest.ts';
import { ledgerMaterials } from './testState.ts';
import { SHOP_TICK_MS } from './config.ts';

const MIN = 60_000;
// The old counter tavern (save 41 layout): the rules of the taps are the same on a bar piece (tested in modularBar.test.ts).
const fresh = (): GameState => save41Start();
const standOf = (s: GameState) => s.items.find((i) => i.typeId === 'tap_stand')!;
const withBag = (s: GameState, materials: Record<string, number>): GameState => applyChange(s, { reason: 'debug', materials }, 0)!;
/** The state at the moment the first guest has an open order (taps as given). */
function untilOrder(s: GameState, seed = 4): GameState {
  const rng = seededRng(seed);
  for (let t = SHOP_TICK_MS; t <= 5 * MIN; t += SHOP_TICK_MS) {
    s = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t).state;
    if (openOrders(s.tavern).length > 0) return s;
  }
  throw new Error('no order');
}

describe('the bar: the register and the tap stand stand ON the counter (step T1)', () => {
  it('a new game has one register and one tap stand on the bar, side by side, 2 taps per stand', () => {
    const s = fresh();
    const bar = barOf(s)!;
    const riders = ridersOf(s.items, bar.uid);
    expect(riders.map((r) => r.typeId).sort()).toEqual(['register', 'tap_stand']);
    expect(TAP_SLOTS).toBe(2);
    expect(TAVERN_START_RIDERS.map((r) => r.typeId)).toEqual(['register', 'tap_stand']);
    const fr = footprintRect(bar, getFurnitureType('counter'));
    const [a, b] = riders.map((r) => footprintRect(r, getFurnitureType(r.typeId))).sort((p, q) => p.x - q.x) as [ReturnType<typeof footprintRect>, ReturnType<typeof footprintRect>];
    for (const r of [a, b]) expect(r.x >= fr.x && r.x + r.w <= fr.x + fr.w && r.y >= fr.y && r.y + r.h <= fr.y + fr.h).toBe(true);
    expect(a.x + a.w).toBe(b.x); // next to each other, no gap
    for (const r of riders) expect(r.onItemUid).toBe(bar.uid);
    expect(getFurnitureType('counter').surface).toBe(true);
  });

  it('they are on-surface items: only on a surface, one level, they move with the bar and need free cells', () => {
    const s = fresh();
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const bar = barOf(s)!;
    const reg = getFurnitureType('register');
    const stand = getFurnitureType('tap_stand');
    expect(reg.onSurface).toBe(true);
    expect(stand.onSurface).toBe(true);
    // On the floor away from the bar there is no spot: not valid as a floor item either (planPlacement puts it on a surface or fails).
    const floor = planPlacement(room, s.items, stand, 400, 320, 'down');
    expect(floor.onItemUid).toBeNull();
    // Over the bar's free third cell: a spot on the bar.
    const free = snapToSurface(room, s.items, stand, bar.x + 32, bar.y, 'down');
    expect(free).toMatchObject({ onItemUid: bar.uid, x: bar.x + 32, y: bar.y });
    // With all three cells taken there is no spot left.
    const full = { ...s, items: [...s.items, { uid: 99, typeId: 'tap_stand', ownerId: 1, roomId: room.id, x: bar.x + 32, y: bar.y, facing: 'down' as const, onItemUid: bar.uid }] };
    expect(snapToSurface(room, full.items, stand, bar.x, bar.y, 'down')).toBeNull();
    expect(snapToSurface(room, full.items, reg, bar.x - 32, bar.y, 'down')).toBeNull();
    // Riders never block walking or the floor: the bar still places and a rider does not count as a floor item.
    expect(canPlace(room, s.items.filter((i) => i.uid !== bar.uid), getFurnitureType('counter'), bar.x, bar.y, 'down')).toBe(true);
    expect(tapStands(s.items, s.tavern.roomId)).toHaveLength(1);
  });
});

describe('loading and unloading taps (ledger reason tap)', () => {
  it('a drink goes from the bag onto a tap; the ledger moves it; nothing is found or lost', () => {
    let s = withBag(fresh(), { carrot_cider: 5 });
    const uid = standOf(s).uid;
    expect(loadRoom(s, uid, 1, 'carrot_cider')).toBe(5);
    s = loadTap(s, uid, 1, 'carrot_cider', 4, 10)!;
    expect(s.player.materials.carrot_cider).toBe(1);
    expect(s.tavern.taps).toEqual([
      { standUid: uid, slot: 0, drink: 'root_ale', mugs: 7 },
      { standUid: uid, slot: 1, drink: 'carrot_cider', mugs: 4 },
    ]);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'tap', materials: { carrot_cider: -4 } });
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    expect(s.player.seen.carrot_cider?.count).toBe(5); // only the 5 from the bag were finds; moving mugs adds none
  });

  it('a tap holds ONE drink and at most TAP_CAP mugs; bad slots, drinks and counts are refused and nothing moves', () => {
    const s0 = withBag(fresh(), { root_ale: 20, carrot_cider: 3, wood: 5, roasted_turnip: 2 });
    const uid = standOf(s0).uid;
    expect(TAP_CAP).toBe(12);
    expect(loadTap(s0, uid, 0, 'carrot_cider', 1, 0)).toBeNull(); // the tap holds root ale
    expect(loadTap(s0, uid, 0, 'root_ale', 6, 0)).toBeNull(); // 7 + 6 > 12
    expect(loadRoom(s0, uid, 0, 'root_ale')).toBe(5);
    const full = loadTap(s0, uid, 0, 'root_ale', 5, 0)!;
    expect(mugsOnTaps(full.tavern.taps, 'root_ale')).toBe(TAP_CAP);
    expect(loadTap(full, uid, 0, 'root_ale', 1, 0)).toBeNull();
    expect(loadTap(s0, uid, 2, 'carrot_cider', 1, 0)).toBeNull(); // only TAP_SLOTS taps
    expect(loadTap(s0, uid, -1, 'carrot_cider', 1, 0)).toBeNull();
    expect(loadTap(s0, uid, 1, 'carrot_cider', 4, 0)).toBeNull(); // the bag has 3
    expect(loadTap(s0, uid, 1, 'carrot_cider', 0, 0)).toBeNull();
    expect(loadTap(s0, uid, 1, 'carrot_cider', 1.5, 0)).toBeNull();
    expect(loadTap(s0, uid, 1, 'wood', 1, 0)).toBeNull(); // not a drink
    expect(loadTap(s0, uid, 1, 'roasted_turnip', 1, 0)).toBeNull(); // dishes come from the bag, never a tap
    expect(loadTap(s0, 9999, 1, 'carrot_cider', 1, 0)).toBeNull(); // no such stand
    expect(s0.tavern.taps).toHaveLength(1);
  });

  it('unload gives the mugs back (a number or all); an emptied tap is free for another drink', () => {
    let s = fresh();
    const uid = standOf(s).uid;
    s = unloadTap(s, uid, 0, 3, 5)!;
    expect(s.player.materials.root_ale).toBe(3);
    expect(s.tavern.taps[0]!.mugs).toBe(4);
    expect(unloadTap(s, uid, 0, 5, 5)).toBeNull(); // more than the tap holds
    expect(unloadTap(s, uid, 0, 0, 5)).toBeNull();
    expect(unloadTap(s, uid, 1, 'all', 5)).toBeNull(); // an empty tap
    s = unloadTap(s, uid, 0, 'all', 6)!;
    expect(s.tavern.taps).toEqual([]);
    expect(s.player.materials.root_ale).toBe(7);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    s = withBag(s, { carrot_cider: 2 });
    expect(loadTap(s, uid, 0, 'carrot_cider', 2, 7)).not.toBeNull();
    expect(s.player.seen.root_ale?.count ?? 0).toBe(0); // the start mugs never counted as finds, and loading and unloading adds none
  });

  it('a tap stand that leaves the bar gives its mugs back to the bag', () => {
    let s = fresh();
    const uid = standOf(s).uid;
    expect(returnOrphanTaps(s, 3)).toBe(s); // nothing to do while it stands
    const inBag = { ...s, items: s.items.map((i) => (i.uid === uid ? { ...i, roomId: null, onItemUid: null } : i)) };
    const back = returnOrphanTaps(inBag, 4);
    expect(back.tavern.taps).toEqual([]);
    expect(back.player.materials.root_ale).toBe(7);
    expect(back.player.materials).toEqual(ledgerMaterials(back));
    s = { ...s, items: s.items.filter((i) => i.uid !== uid) };
    expect(returnOrphanTaps(s, 4).player.materials.root_ale).toBe(7);
  });
});

describe('a drink is on the menu only while it is on a tap with a mug', () => {
  it('drinks in the bag are not on the menu; load them and they are', () => {
    let s = withBag(fresh(), { carrot_cider: 3 });
    expect(menuRows(s).map((r) => r.id).sort()).toEqual(['roasted_turnip', 'root_ale']);
    expect(menuOffers(s).map((o) => o.id)).toEqual(['root_ale']); // the dish has no stock yet
    s = loadTap(s, standOf(s).uid, 1, 'carrot_cider', 3, 0)!;
    expect(menuOffers(s).map((o) => o.id).sort()).toEqual(['carrot_cider', 'root_ale']);
    expect(menuRows(s).find((r) => r.id === 'carrot_cider')).toMatchObject({ stock: 3, on: true });
  });

  it('dishes still come from the bag: a dish in the bag is offered without any tap', () => {
    const s = withBag(fresh(), { roasted_turnip: 2 });
    expect(menuOffers(s).find((o) => o.id === 'roasted_turnip')).toMatchObject({ stock: 2 });
  });

  it('an order only reserves a mug: stock for new orders is mugs minus open orders, the tap keeps its count until the pour', () => {
    let s = untilOrder(withAle());
    expect(openOrders(s.tavern).length).toBeGreaterThan(0);
    expect(mugsOnTaps(s.tavern.taps, 'root_ale')).toBe(6); // nothing poured yet
    expect(stockFor(s.tavern, 'root_ale')).toBe(6 - openOrders(s.tavern).length);
    expect(s.player.materials.root_ale).toBeUndefined(); // and nothing left the bag (there was none)
    s = withLongTable(s);
    expect(menuOffers(s).every((o) => o.stock <= 6)).toBe(true);
  });

  it('with 2 mugs on the tap and many guests, at most 2 open orders ever (no over-ordering within a step)', () => {
    let s = withLongTable(withAle());
    s = unloadTap(s, standOf(s).uid, 0, 4, 0)!;
    const rng = seededRng(21);
    let most = 0;
    runTavern(s, 0, 20 * MIN, rng, true, (x) => {
      most = Math.max(most, openOrders(x.tavern).length);
    });
    expect(mugsOnTaps(s.tavern.taps, 'root_ale')).toBe(2);
    expect(most).toBe(2);
  });
});

describe('pouring (rules): the avatar takes the mug off the tap', () => {
  it('a loaded tap serves and counts down by one per order; the order is in the hands', () => {
    let s = untilOrder(withAle());
    const g = openOrders(s.tavern)[0]!;
    s = requestServe(s, g.id)!;
    expect(nextOrder(s)).toMatchObject({ guestId: g.id, item: 'root_ale' });
    const p = pourOrder(s)!;
    expect(p.empty).toBe(false);
    if (p.empty) return;
    expect(p).toMatchObject({ guestId: g.id, item: 'root_ale', standUid: standOf(s).uid, slot: 0 });
    expect(mugsOnTaps(p.state.tavern.taps, 'root_ale')).toBe(5);
    expect(p.state.tavern.tray).toEqual([{ item: 'root_ale' }]);
    expect(p.state.tavern.serveQueue).toEqual([]);
    expect(p.state.player.materials).toEqual(ledgerMaterials(p.state));
  });

  it('an empty tap: nothing is poured, the guest leaves the queue and the ORDER STAYS OPEN', () => {
    let s = untilOrder(withAle());
    const g = openOrders(s.tavern)[0]!;
    s = requestServe(s, g.id)!;
    s = unloadTap(s, standOf(s).uid, 0, 'all', 0)!; // the player emptied the tap after the order
    const p = pourOrder(s)!;
    expect(p.empty).toBe(true);
    expect(p.state.tavern.tray).toEqual([]);
    expect(p.state.tavern.serveQueue).toEqual([]);
    expect(openOrders(p.state.tavern).map((x) => x.id)).toContain(g.id);
    expect(tapFor(p.state.tavern.taps, 'root_ale')).toBeUndefined();
    // Load again and the same order can be served.
    const again = loadTap(p.state, standOf(s).uid, 0, 'root_ale', 1, 1)!;
    expect(pourOrder(requestServe(again, g.id)!)!.empty).toBe(false);
  });

  it('the last mug empties the tap: the tap is gone from the list (no zero mugs kept) and the next order has no stock', () => {
    let s = withAle();
    s = unloadTap(s, standOf(s).uid, 0, 5, 0)!;
    let s2 = untilOrder(s);
    const g = openOrders(s2.tavern)[0]!;
    s2 = requestServe(s2, g.id)!;
    const p = pourOrder(s2)!;
    if (p.empty) throw new Error('should pour');
    expect(p.state.tavern.taps).toEqual([]);
    expect(menuOffers(p.state)).toEqual([]);
    expect(tapFor(p.state.tavern.taps, 'root_ale')).toBeUndefined();
  });

  it('serve stops: a drink goes to the stand level with the taps behind the bar, a dish to the middle behind the bar', () => {
    let s = untilOrder(withAle());
    const g = openOrders(s.tavern)[0]!;
    const stops = serveStops(s, g.id)!;
    const bar = barOf(s)!;
    expect(stops.bar).toEqual(pourPoint(bar, standOf(s)));
    expect(stops.bar.y).toBeLessThan(bar.y - 32); // behind the bar (facing down: above it)
    expect(stops.bar.x).toBe(standOf(s).x);
    // With no tap holding it the stop falls back to the middle behind the bar.
    s = unloadTap(s, standOf(s).uid, 0, 'all', 0)!;
    expect(serveStops(s, g.id)!.bar.x).toBe(bar.x);
  });

  it('over a long evening every mug that leaves a tap is a drink somebody was served; the bag ledger still adds up', () => {
    let s = withLongTable(withAle());
    const rng = seededRng(33);
    const hand = seededRng(34);
    const served = new Set<number>();
    s = runTavern(s, 0, 30 * MIN, rng, true, (x, events) => {
      for (const e of events) if (e.t === 'order') served.add(e.guestId);
      return serveAll(x, hand);
    });
    const left = mugsOnTaps(s.tavern.taps, 'root_ale');
    expect(served.size).toBeGreaterThan(3);
    expect(left).toBe(Math.max(0, 6 - served.size)); // one mug per order, never more than the tap held
    expect(s.player.materials).toEqual(ledgerMaterials(s));
  });
});

describe('helpers', () => {
  it('the Tap type holds a stand, a slot, one drink and mugs', () => {
    const t: Tap = { standUid: 1, slot: 0, drink: 'root_ale', mugs: 1 };
    expect(t.mugs).toBe(1);
  });
});

describe('the Taps panel cards (pure)', () => {
  it('one card per tap: an empty tap offers every drink in the bag that fits, a tap with a drink only that drink', () => {
    const mats = { root_ale: 20, carrot_cider: 3, wood: 4 };
    const cards = tapCards([5], [{ standUid: 5, slot: 0, drink: 'root_ale', mugs: 9 }], mats);
    expect(cards).toHaveLength(TAP_SLOTS);
    expect(cards[0]).toEqual({ standUid: 5, slot: 0, drink: 'root_ale', mugs: 9, cap: TAP_CAP, options: [{ drink: 'root_ale', inBag: 20, fits: 3 }] });
    expect(cards[1]).toMatchObject({ slot: 1, drink: null, mugs: 0, options: [{ drink: 'root_ale', inBag: 20, fits: 12 }, { drink: 'carrot_cider', inBag: 3, fits: 3 }] });
  });

  it('a full tap and an empty bag offer nothing; two stands give four cards', () => {
    const cards = tapCards([1, 2], [{ standUid: 1, slot: 0, drink: 'root_ale', mugs: 12 }], { root_ale: 5 });
    expect(cards).toHaveLength(2 * TAP_SLOTS);
    expect(cards[0]!.options).toEqual([]);
    expect(tapCards([1], [], {})[0]!.options).toEqual([]);
  });
});
