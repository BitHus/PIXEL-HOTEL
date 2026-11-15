import { describe, expect, it } from 'vitest';
import { SERVE_QUEUE_MAX } from './config.ts';
import { catalogPrice } from './economy.ts';
import { behindPoint, getFurnitureType, staffZone } from './furniture.ts';
import { inStaffZone } from './npcNav.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import {
  chooseOrder,
  clearDish,
  coinsFor,
  collectCoins,
  freeTavernSeats,
  guestIntervalMs,
  menuEntry,
  menuOffers,
  menuRows,
  pickSeats,
  pickUpOrder,
  requestServe,
  serveStops,
  setMenu,
  tavernCounts,
  tavernSeats,
  type Guest,
  type MenuOffer,
} from './tavern.ts';
import { withAle, withItem, withLongTable } from './tavernTest.ts';
import { ledgerGold } from './testState.ts';
import type { GameState } from './gameState.ts';

const offer = (id: MenuOffer['id'], price: number, baseValue: number): MenuOffer => ({ id, price, baseValue, stock: 5 });

/** A guest sitting on a start stool with an open order for root ale (the ale is not taken from the bag here). */
function waiting(s: GameState, id: number, seatUid: number): GameState {
  const seat = tavernSeats(s.items, s.tavern.roomId).find((k) => k.uid === seatUid)!;
  const g: Guest = {
    id, kind: 'browser', look: s.look, x: seat.x, y: seat.y, facing: seat.facing, path: [], speed: 72, phase: 'order', groupId: id,
    seat: { uid: seat.uid, index: seat.index }, seated: true, tolerance: 1, waitMs: 0, order: { item: 'root_ale', price: 9, coins: 9 },
    patienceMs: 90_000, warned: false, talkInMs: 5000, sipInMs: 0, reaction: 'smile',
  };
  return { ...s, tavern: { ...s.tavern, guests: [...s.tavern.guests, g] } };
}

describe('the menu (step 9t)', () => {
  it('drinks are on the menu at their value until the player chooses; dishes are off', () => {
    const s = applyChange(withAle(), { reason: 'debug', materials: { potato_stew: 2, wood: 5 } }, 0)!;
    expect(menuEntry(s.tavern, 'root_ale')).toEqual({ on: true, price: 9 });
    expect(menuEntry(s.tavern, 'potato_stew').on).toBe(false);
    // Only drinks and dishes are rows; only what is on and in stock is offered.
    expect(menuRows(s).map((r) => r.id).sort()).toEqual(['potato_stew', 'root_ale']);
    expect(menuOffers(s)).toEqual([{ id: 'root_ale', price: 9, baseValue: 9, stock: 6 }]);
  });

  it('the player puts things on and off the menu and sets a price each', () => {
    let s = applyChange(withAle(), { reason: 'debug', materials: { potato_stew: 2 } }, 0)!;
    s = setMenu(s, 'potato_stew', { on: true, price: 25 })!;
    s = setMenu(s, 'root_ale', { price: 12 })!;
    expect(menuOffers(s).map((o) => [o.id, o.price]).sort()).toEqual([['potato_stew', 25], ['root_ale', 12]]);
    s = setMenu(s, 'root_ale', { on: false })!;
    expect(menuOffers(s).map((o) => o.id)).toEqual(['potato_stew']);
    expect(menuEntry(s.tavern, 'root_ale')).toEqual({ on: false, price: 12 });
    expect(setMenu(s, 'root_ale', { price: 0 })).toBeNull();
    expect(setMenu(s, 'root_ale', { price: 2.5 })).toBeNull();
    expect(setMenu(s, 'wood', { on: true })).toBeNull();
  });

  it('out of stock is off the menu (the row stays for when there is stock again)', () => {
    let s = setMenu(withAle(), 'root_ale', { price: 10 })!;
    s = applyChange(s, { reason: 'debug', materials: { root_ale: -6 } }, 0)!;
    expect(menuOffers(s)).toEqual([]);
    expect(menuRows(s)).toEqual([{ id: 'root_ale', price: 10, baseValue: 9, stock: 0, on: true }]);
  });

  it('the price rule: fair = smile, cheap = big smile, too high = something cheaper or nothing', () => {
    const rng = seededRng(1);
    expect(chooseOrder([], 1, rng)).toBeNull();
    expect(chooseOrder([offer('root_ale', 10, 10)], 1, rng)).toMatchObject({ order: { id: 'root_ale' }, reaction: 'smile', refused: null });
    expect(chooseOrder([offer('root_ale', 7, 10)], 1, rng)).toMatchObject({ order: { id: 'root_ale' }, reaction: 'big_smile' });
    // A bit too high and nothing else: a shrug, far too high: a frown; no order.
    expect(chooseOrder([offer('root_ale', 11, 10)], 1, rng)).toMatchObject({ order: null, reaction: 'shrug', refused: { id: 'root_ale' } });
    expect(chooseOrder([offer('root_ale', 20, 10)], 1, rng)).toMatchObject({ order: null, reaction: 'frown' });
    // Two things: whichever the guest wants first, they end up with the one at a fair price.
    const menu = [offer('glowcap_tonic', 60, 22), offer('root_ale', 9, 9)];
    let refusedFirst = 0;
    for (let k = 0; k < 40; k++) {
      const c = chooseOrder(menu, 1, rng)!;
      expect(c.order?.id).toBe('root_ale');
      if (c.refused) {
        refusedFirst++;
        expect(c.refused.id).toBe('glowcap_tonic');
      }
    }
    expect(refusedFirst).toBeGreaterThan(5);
    expect(refusedFirst).toBeLessThan(35);
    // The cheaper thing must itself be acceptable, and really cost less.
    expect(chooseOrder([offer('glowcap_tonic', 60, 22), offer('root_ale', 30, 9)], 1, () => 0)).toMatchObject({ order: null, refused: { id: 'glowcap_tonic' } });
    // A higher tolerance accepts a higher price.
    expect(chooseOrder([offer('root_ale', 12, 10)], 1.3, rng)?.order?.id).toBe('root_ale');
  });

  it('guests tip extra for the glowcap tonic', () => {
    expect(coinsFor('root_ale', 10)).toBe(10);
    expect(coinsFor('potato_stew', 20)).toBe(20);
    expect(coinsFor('glowcap_tonic', 20)).toBe(25);
  });

  it('more appeal brings guests faster', () => {
    expect(guestIntervalMs(0)).toBe(45_000);
    expect(guestIntervalMs(100)).toBe(22_500);
  });
});

describe('seats at tables (step 9t)', () => {
  it('a seat counts when a table is next to it: the two start stools at the round table', () => {
    const s = createNewPlayer(undefined, 0);
    const table = s.items.find((i) => i.typeId === 'round_table')!;
    const seats = tavernSeats(s.items, s.tavern.roomId);
    expect(seats.map((k) => k.tableUid)).toEqual([table.uid, table.uid]);
    // Each seat has its own spot on the table, on its own side.
    const [left, right] = seats;
    expect(left!.spot.x).toBeLessThan(table.x);
    expect(right!.spot.x).toBeGreaterThan(table.x);
    for (const k of seats) expect(Math.abs(k.spot.x - table.x)).toBeLessThanOrEqual(24);
  });

  it('on the cell grid: a stool on a cell side by side with a table cell is a seat, a diagonal or a gap away is not', () => {
    // The round table fills the cells x 416..480, y 160..224 (columns 13-14, rows 5-6).
    let s = createNewPlayer(undefined, 0);
    const table = s.items.find((i) => i.typeId === 'round_table')!;
    s = withItem(s, 70, 'bar_stool', 432, 160, 'up'); // the cell above the table, turned away from it
    s = withItem(s, 71, 'bar_stool', 400, 160); // the cell above the table's left corner: diagonal
    s = withItem(s, 72, 'bar_stool', 368, 192); // one cell away from the left stool: a gap
    const seats = tavernSeats(s.items, s.tavern.roomId);
    expect(seats.map((k) => k.uid).sort((a, b) => a - b)).toEqual([4, 5, 70]);
    const above = seats.find((k) => k.uid === 70)!;
    expect(above.tableUid).toBe(table.uid);
    // A guest looks at the table, whichever way the stool was turned.
    expect(above.facing).toBe('down');
    for (const k of seats.filter((x) => x.uid !== 70)) expect(['left', 'right']).toContain(k.facing);
  });

  it('a chair in the open is no tavern seat; a stool at the bar is, but never behind it', () => {
    let s = createNewPlayer(undefined, 0);
    const bar = s.items.find((i) => i.typeId === 'counter')!;
    const type = getFurnitureType('counter');
    s = withItem(s, 60, 'chair', 300, 280); // far from every table
    s = withItem(s, 61, 'bar_stool', bar.x, bar.y + 28, 'up'); // the guests' side of the bar
    const behind = behindPoint(bar, type);
    s = withItem(s, 62, 'bar_stool', behind.x, behind.y + 12); // the staff side
    expect(inStaffZone([staffZone(bar, type)], { x: behind.x, y: behind.y })).toBe(true);
    const seats = tavernSeats(s.items, s.tavern.roomId);
    expect(seats.map((k) => k.uid).sort()).toEqual([4, 5, 61]);
    expect(seats.find((k) => k.uid === 61)!.tableUid).toBe(bar.uid);
  });

  it('a group sits together when a table has room, else spread; too few seats = none', () => {
    const s = withLongTable(createNewPlayer(undefined, 0));
    const free = freeTavernSeats(s.tavern, tavernSeats(s.items, s.tavern.roomId));
    expect(free.length).toBe(5);
    for (let seed = 1; seed <= 20; seed++) {
      const three = pickSeats(free, 3, seededRng(seed))!;
      expect(three.map((k) => k.tableUid)).toEqual([50, 50, 50]);
      const two = pickSeats(free, 2, seededRng(seed))!;
      expect(new Set(two.map((k) => k.tableUid)).size).toBe(1);
    }
    // 4 do not fit at one table: they take the long table and one stool of the round one.
    const four = pickSeats(free, 4, seededRng(3))!;
    expect(four.filter((k) => k.tableUid === 50).length).toBe(3);
    expect(new Set(four.map((k) => `${k.uid}:${k.index}`)).size).toBe(4);
    expect(pickSeats(free, 6, seededRng(3))).toBeNull();
    expect(pickSeats([], 1, seededRng(3))).toBeNull();
  });

  it('coins or a dish on a table spot block that seat until both are gone', () => {
    let s = withAle();
    const seats = tavernSeats(s.items, s.tavern.roomId);
    const seat = seats[0]!;
    s = { ...s, tavern: { ...s.tavern, mess: [{ id: 1, seatUid: seat.uid, seatIndex: seat.index, x: seat.spot.x, y: seat.spot.y, coins: 9, dish: 'root_ale' }], nextMessId: 2 } };
    expect(freeTavernSeats(s.tavern, seats).map((k) => k.uid)).toEqual([seats[1]!.uid]);
    expect(tavernCounts(s.tavern)).toEqual({ orders: 0, coins: 1, dishes: 1 });
    // The coins: only when the player takes them, through the ledger.
    const gold = s.player.wallet.gold;
    const paid = collectCoins(s, 1, 500)!;
    expect(paid.coins).toBe(9);
    expect(paid.state.player.wallet.gold).toBe(gold + 9);
    expect(paid.state.ledger.at(-1)).toMatchObject({ reason: 'tavern', goldDelta: 9 });
    expect(ledgerGold(paid.state)).toBe(paid.state.player.wallet.gold);
    expect(collectCoins(paid.state, 1, 600)).toBeNull();
    // The empty mug still blocks the seat.
    expect(freeTavernSeats(paid.state.tavern, seats).length).toBe(1);
    const clean = clearDish(paid.state, 1)!;
    expect(clean.tavern.mess).toEqual([]);
    expect(freeTavernSeats(clean.tavern, seats).length).toBe(2);
    expect(clearDish(clean, 1)).toBeNull();
    // The other order: the dish first, then the coins.
    const cleared = clearDish(s, 1)!;
    expect(cleared.tavern.mess).toEqual([{ ...s.tavern.mess[0]!, dish: null }]);
    expect(freeTavernSeats(cleared.tavern, seats).length).toBe(1);
    expect(collectCoins(cleared, 1, 700)!.state.tavern.mess).toEqual([]);
  });

  it('the player and seats already kept for guests are not free', () => {
    const s = waiting(withAle(), -1, 4);
    const seats = tavernSeats(s.items, s.tavern.roomId);
    expect(freeTavernSeats(s.tavern, seats).map((k) => k.uid)).toEqual([5]);
    expect(freeTavernSeats(s.tavern, seats, [{ uid: 5, index: 0 }])).toEqual([]);
  });
});

describe('the serve queue (step 9t)', () => {
  it('taps queue up, at most 3, each guest once, only guests with an open order', () => {
    let s = withLongTable(withAle());
    for (const [k, uid] of [4, 5, 51, 52].entries()) s = waiting(s, -1 - k, uid);
    expect(requestServe(s, -99)).toBeNull();
    for (const id of [-2, -1, -3]) s = requestServe(s, id)!;
    expect(s.tavern.serveQueue).toEqual([-2, -1, -3]);
    expect(s.tavern.serveQueue.length).toBe(SERVE_QUEUE_MAX);
    expect(requestServe(s, -4)).toBeNull();
    expect(requestServe(s, -1)).toBeNull();
    // At the bar the player picks up the first order; with full hands nothing more.
    const picked = pickUpOrder(s)!;
    expect(picked).toMatchObject({ guestId: -2, item: 'root_ale' });
    expect(picked.state.tavern.holding).toEqual({ guestId: -2, item: 'root_ale' });
    expect(picked.state.tavern.serveQueue).toEqual([-1, -3]);
    expect(pickUpOrder(picked.state)).toBeNull();
    expect(requestServe(picked.state, -2)).toBeNull();
    // Now there is room in the queue again.
    expect(requestServe(picked.state, -4)?.tavern.serveQueue).toEqual([-1, -3, -4]);
  });

  it('an order of a guest who left is skipped', () => {
    let s = waiting(waiting(withAle(), -1, 4), -2, 5);
    s = requestServe(requestServe(s, -1)!, -2)!;
    s = { ...s, tavern: { ...s.tavern, guests: s.tavern.guests.filter((g) => g.id !== -1) } };
    expect(pickUpOrder(s)).toMatchObject({ guestId: -2 });
    expect(pickUpOrder({ ...s, tavern: { ...s.tavern, guests: [] } })).toBeNull();
  });

  it('the stops for an order: behind the bar, then the guest\'s table spot', () => {
    const s = waiting(withAle(), -1, 5);
    const bar = s.items.find((i) => i.typeId === 'counter')!;
    const seat = tavernSeats(s.items, s.tavern.roomId).find((k) => k.uid === 5)!;
    expect(serveStops(s, -1)).toEqual({ bar: behindPoint(bar, getFurnitureType('counter')), table: seat.spot });
    expect(serveStops(s, -7)).toBeNull();
  });
});

describe('the Tavern catalog tab (step 9t C)', () => {
  const ids = ['bar_stool', 'round_table', 'long_table', 'mug_shelf', 'menu_board', 'keg_rack', 'brewing_barrel', 'stove'];
  it('lists the eight tavern pieces, in the shop category, for the tavern, at baseValue * 3', () => {
    for (const id of ids) {
      const t = getFurnitureType(id);
      expect(t.category, id).toBe('shop_furniture');
      expect(t.inCatalog, id).toBe(true);
      expect(['shop', 'both'], id).toContain(t.placeIn);
      expect(catalogPrice(id), id).toBe(t.baseValue * 3);
    }
    expect(getFurnitureType('mug_shelf').wall).toBe(true);
    expect(getFurnitureType('menu_board').wall).toBe(true);
    expect(getFurnitureType('brewing_barrel').brews).toBe(true);
    expect(getFurnitureType('stove').cooks).toBe(true);
    // The keg rack stays decor for now (ripening is step K2).
    expect(getFurnitureType('keg_rack').brews).toBeFalsy();
  });
});
