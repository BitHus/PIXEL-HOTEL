import { describe, expect, it } from 'vitest';
import { AWAY_ORDERS_MAX, GUEST_EAT_MAX_MS, GUEST_EAT_MIN_MS, GUEST_MAX, GUEST_PATIENCE_MS, SHOP_TICK_MS } from './config.ts';
import { inStaffZone, staffZones } from './npcNav.ts';
import type { GameState } from './gameState.ts';
import { catchUpTavern, deliverOrder, rollGroupSize, stepTavern, type TavernEvent } from './guests.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { NPC_LINES } from './npcTalk.ts';
import { seededRng } from './rng.ts';
import { readSave, toSaveText } from './save.ts';
import { clearDish, collectCoins, openOrders, pickUpOrder, requestServe, seatKey, setMenu, tavernSeats } from './tavern.ts';
import { drinkStock } from './taps.ts';
import { runTavern, serveAll, stock, tavernWorld, tidy, legacyStart, withAle, withItem, withLongTable } from './tavernTest.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';

const MIN = 60_000;
/** Root ale a new guest could still order: the mugs on the taps not claimed by an open order (T1). */
const ale = (s: GameState): number => drinkStock(s, 'root_ale');

/** Runs until `done` says so (at most ms); returns the state and the time. */
function until(s: GameState, ms: number, rng: () => number, done: (s: GameState, e: TavernEvent[]) => boolean, playerHere = true): { s: GameState; t: number } {
  let t = 0;
  for (; t < ms; ) {
    t += SHOP_TICK_MS;
    const r = stepTavern(s, tavernWorld(s, playerHere), SHOP_TICK_MS, rng, t);
    s = r.state;
    if (done(s, r.events)) break;
  }
  return { s, t };
}

describe('guests: seating and groups (step 9t)', () => {
  it('guests walk in, sit on the stools at the table and order from the menu', () => {
    const events: TavernEvent[] = [];
    const { s } = until(withAle(), 2 * MIN, seededRng(4), (x, e) => (events.push(...e), openOrders(x.tavern).length > 0));
    const [g] = openOrders(s.tavern);
    expect(g).toBeDefined();
    const seat = tavernSeats(s.items, s.tavern.roomId).find((k) => seatKey(k) === seatKey(g!.seat!))!;
    expect(g).toMatchObject({ seated: true, x: seat.x, y: seat.y, facing: seat.facing, path: [], order: { item: 'root_ale', price: 9, coins: 9 } });
    expect(g!.id).toBeLessThan(0);
    // The order is out of the bag at once, through the ledger.
    expect(ale(s)).toBe(6 - openOrders(s.tavern).length);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    expect(events.find((e) => e.t === 'order')).toMatchObject({ guestId: g!.id, item: 'root_ale', price: 9, reaction: 'smile' });
    expect(events.some((e) => e.t === 'guests')).toBe(true);
  });

  it('comes alone, as a pair or as three', () => {
    const rng = seededRng(9);
    const sizes = new Set(Array.from({ length: 200 }, () => rollGroupSize(rng)));
    expect([...sizes].sort()).toEqual([1, 2, 3]);
  });

  it('never more guests than seats, never two on one seat, never behind the bar', () => {
    let s = withAle();
    const zones = staffZones(s.items, s.tavern.roomId);
    let most = 0;
    s = runTavern(s, 0, 10 * MIN, seededRng(7), true, (x) => {
      most = Math.max(most, x.tavern.guests.length);
      const keys = x.tavern.guests.flatMap((g) => (g.seat ? [seatKey(g.seat)] : []));
      expect(new Set(keys).size).toBe(keys.length);
      for (const g of x.tavern.guests) expect(inStaffZone(zones, g)).toBe(false);
      return serveAll(x, seededRng(1));
    });
    expect(most).toBe(2);
    // With many seats the config cap holds.
    let big = withLongTable(stock(withAle(), 'root_ale', 200));
    for (let k = 0; k < 3; k++) big = withItem(big, 54 + k, 'bar_stool', 48 + k * 32, 288, 'up'); // below the table
    big = withItem(withItem(big, 57, 'bar_stool', 16, 256, 'right'), 58, 'bar_stool', 176, 256, 'left'); // at its ends
    expect(tavernSeats(big.items, big.tavern.roomId).length).toBe(10);
    let top = 0;
    runTavern(big, 0, 30 * MIN, seededRng(8), true, (x) => {
      top = Math.max(top, x.tavern.guests.length);
      expect(x.tavern.guests.length).toBeLessThanOrEqual(GUEST_MAX);
    });
    expect(top).toBeGreaterThan(4);
  });

  it('a group of three sits together at the long table', () => {
    let s = withLongTable(stock(withAle(), 'root_ale', 50));
    let seen = false;
    s = runTavern(s, 0, 20 * MIN, seededRng(21), true, (x) => {
      const byGroup = new Map<number, number[]>();
      const seats = tavernSeats(x.items, x.tavern.roomId);
      for (const g of x.tavern.guests) {
        if (!g.seat || g.phase === 'leave') continue;
        byGroup.set(g.groupId, [...(byGroup.get(g.groupId) ?? []), seats.find((k) => seatKey(k) === seatKey(g.seat!))!.tableUid]);
      }
      for (const tables of byGroup.values()) {
        // (When the long table is partly taken a group spreads over the free seats instead.)
        if (tables.length === 3 && tables.every((uid) => uid === 50)) seen = true;
      }
      return tidy(serveAll(x, seededRng(2)), 0);
    });
    expect(seen).toBe(true);
  });

  it('no free seat: they stand a moment, say so and leave', () => {
    let s = withAle();
    // Both table spots still have coins on them.
    const mess = tavernSeats(s.items, s.tavern.roomId).map((k, i) => ({ id: i + 1, seatUid: k.uid, seatIndex: k.index, x: k.spot.x, y: k.spot.y, coins: 9, gems: 0, dish: null }));
    s = { ...s, tavern: { ...s.tavern, mess, nextMessId: 3 } };
    const said: string[] = [];
    let came = 0;
    s = runTavern(s, 0, 3 * MIN, seededRng(5), true, (x, e) => {
      came = Math.max(came, x.tavern.guests.length);
      for (const g of x.tavern.guests) expect(g.seated).toBe(false);
      for (const ev of e) if (ev.t === 'say') said.push(ev.text);
    });
    expect(came).toBeGreaterThan(0);
    expect(said.some((line) => NPC_LINES.no_seat.includes(line))).toBe(true);
    expect(ale(s)).toBe(6);
    // Once the player took the coins, guests sit down again.
    s = collectCoins(collectCoins(s, 1, 0)!.state, 2, 0)!.state;
    expect(until(s, 3 * MIN, seededRng(5), (x) => x.tavern.guests.some((g) => g.seated)).s.tavern.guests.some((g) => g.seated)).toBe(true);
  });

  it('an empty menu: guests still come in, sit, say so and leave without leaving anything', () => {
    const said: string[] = [];
    let sat = false;
    const s = runTavern(legacyStart(), 0, 4 * MIN, seededRng(6), true, (x, e) => {
      sat ||= x.tavern.guests.some((g) => g.seated && g.phase === 'no_menu');
      for (const ev of e) if (ev.t === 'say') said.push(ev.text);
      expect(e.some((ev) => ev.t === 'order' || ev.t === 'coins')).toBe(false);
    });
    expect(sat).toBe(true);
    expect(said.some((line) => NPC_LINES.no_menu.includes(line))).toBe(true);
    expect(s.tavern.mess).toEqual([]);
    expect(s.ledger.length).toBe(legacyStart().ledger.length);
  });
});

describe('guests: the order and serve chain (step 9t)', () => {
  it('tap, pick up at the bar, put down: the guest eats 20 to 40 s, leaves coins and the mug, and walks out', () => {
    const rng = seededRng(11);
    let { s, t } = until(withAle(), 5 * MIN, rng, (x) => openOrders(x.tavern).length > 0);
    const guest = openOrders(s.tavern)[0]!;
    const gold = s.player.wallet.gold;
    s = requestServe(s, guest.id)!;
    const picked = pickUpOrder(s)!;
    expect(picked.item).toBe('root_ale');
    const served = deliverOrder(picked.state, rng)!;
    expect(served).toMatchObject({ guestId: guest.id, item: 'root_ale' });
    s = served.state;
    expect(s.tavern.holding).toBeNull();
    expect(deliverOrder(s, rng)).toBeNull();
    const eating = s.tavern.guests.find((g) => g.id === guest.id)!;
    expect(eating.phase).toBe('eat');
    expect(eating.waitMs).toBeGreaterThanOrEqual(GUEST_EAT_MIN_MS);
    expect(eating.waitMs).toBeLessThan(GUEST_EAT_MAX_MS);
    // Eating: sips, the item still theirs, no coins yet.
    const start = t;
    let sips = 0;
    let coinsAt = 0;
    let messEvent: TavernEvent | undefined;
    for (; t < start + GUEST_EAT_MAX_MS + 1000 && !coinsAt; ) {
      t += SHOP_TICK_MS;
      const r = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t);
      s = r.state;
      sips += r.events.filter((e) => e.t === 'sip' && e.guestId === guest.id).length;
      messEvent = r.events.find((e) => e.t === 'coins' && e.guestId === guest.id);
      if (messEvent) coinsAt = t;
    }
    expect(coinsAt - start).toBeGreaterThanOrEqual(GUEST_EAT_MIN_MS);
    expect(sips).toBeGreaterThan(2);
    const seat = tavernSeats(s.items, s.tavern.roomId).find((k) => seatKey(k) === seatKey(guest.seat!))!;
    const mess = s.tavern.mess.find((m) => m.seatUid === seat.uid)!;
    expect(mess).toMatchObject({ seatIndex: seat.index, x: seat.spot.x, y: seat.spot.y, coins: 9, dish: 'root_ale' });
    expect(messEvent).toMatchObject({ mess });
    expect(s.tavern.history.root_ale).toEqual([9]);
    // Nothing is collected automatically: the gold only moves when the player takes the coins.
    s = runTavern(s, t, 3 * MIN, rng, true, (x) => {
      expect(x.tavern.guests.some((g) => g.seat && seatKey(g.seat) === seatKey(seat))).toBe(false);
    });
    expect(s.tavern.guests.some((g) => g.id === guest.id)).toBe(false);
    expect(s.tavern.mess.find((m) => m.id === mess.id)).toEqual(mess);
    const served2 = s.ledger.filter((e) => e.reason === 'tavern').length;
    expect(served2).toBe(0);
    expect(s.player.wallet.gold).toBe(gold);
    const paid = collectCoins(s, mess.id, t)!;
    expect(paid.state.player.wallet.gold).toBe(gold + 9);
    expect(clearDish(paid.state, mess.id)!.tavern.mess.some((m) => m.id === mess.id)).toBe(false);
  });

  it('a too high price: the guest orders nothing, shows a face and leaves', () => {
    const s0 = setMenu(withAle(), 'root_ale', { price: 40 })!;
    const events: TavernEvent[] = [];
    const s = runTavern(s0, 0, 3 * MIN, seededRng(3), true, (_x, e) => void events.push(...e));
    expect(events.find((e) => e.t === 'refuse')).toMatchObject({ item: 'root_ale', reaction: 'frown' });
    expect(events.some((e) => e.t === 'order')).toBe(false);
    expect(ale(s)).toBe(6);
    expect(s.tavern.mess).toEqual([]);
  });

  it('a guest who finds one drink too dear orders the cheaper one', () => {
    let s0 = stock(withAle(), 'glowcap_tonic', 4);
    s0 = setMenu(s0, 'glowcap_tonic', { price: 90 })!;
    const events: TavernEvent[] = [];
    runTavern(s0, 0, 15 * MIN, seededRng(13), true, (x, e) => (events.push(...e), tidy(serveAll(x, seededRng(1)), 0)));
    const orders = events.filter((e) => e.t === 'order');
    expect(orders.length).toBeGreaterThan(3);
    expect(orders.every((e) => e.t === 'order' && e.item === 'root_ale')).toBe(true);
    expect(orders.some((e) => e.t === 'order' && e.refused === 'glowcap_tonic')).toBe(true);
  });

  it('the patience timer: a guest who waits about 90 s leaves unhappy, pays nothing, and the mug goes back', () => {
    const rng = seededRng(15);
    let { s, t } = until(withAle(), 5 * MIN, rng, (x) => openOrders(x.tavern).length > 0);
    const guest = openOrders(s.tavern)[0]!;
    s = pickUpOrder(requestServe(s, guest.id)!)!.state; // in the player's hands, but never brought
    const said: string[] = [];
    let leftAt = 0;
    const start = t;
    for (; t < start + 3 * MIN && !leftAt; ) {
      t += SHOP_TICK_MS;
      const r = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const e of r.events) if (e.t === 'say' && e.guestId === guest.id) said.push(e.text);
      if (r.events.some((e) => e.t === 'unhappy' && e.guestId === guest.id)) leftAt = t;
    }
    expect(leftAt - start).toBeGreaterThanOrEqual(GUEST_PATIENCE_MS - SHOP_TICK_MS);
    expect(leftAt - start).toBeLessThanOrEqual(GUEST_PATIENCE_MS + SHOP_TICK_MS);
    // They called for the order first, then said why they go.
    expect(said.some((line) => NPC_LINES.order_wait.includes(line))).toBe(true);
    expect(said.some((line) => NPC_LINES.unhappy.includes(line))).toBe(true);
    const gone = s.tavern.guests.find((g) => g.id === guest.id)!;
    expect(gone).toMatchObject({ phase: 'leave', order: null, seat: null, reaction: 'frown' });
    expect(s.tavern.holding).toBeNull();
    expect(s.tavern.mess).toEqual([]);
    expect(ale(s)).toBe(6 - openOrders(s.tavern).length);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    // Being put back is not a new find for the Book.
    expect(s.player.seen.root_ale?.count).toBe(7); // the Book saw the 7 mugs of the start barrel (withAle then took one away)
  });

  it('a seat taken away under a waiting guest: the order goes back and they leave', () => {
    const rng = seededRng(15);
    let { s, t } = until(withAle(), 5 * MIN, rng, (x) => openOrders(x.tavern).length > 0);
    const n = openOrders(s.tavern).length;
    s = { ...s, items: s.items.map((i) => (i.typeId === 'round_table' ? { ...i, roomId: null } : i)) };
    s = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t + SHOP_TICK_MS).state;
    expect(openOrders(s.tavern)).toEqual([]);
    expect(ale(s)).toBe(6);
    expect(n).toBeGreaterThan(0);
  });

  it('the ledger still adds up after a long evening, and every guest keeps a different id', () => {
    let s = applyChange(stock(stock(withLongTable(withAle()), 'root_ale', 60), 'glowcap_tonic', 20), { reason: 'debug', materials: { wood: 20 } }, 0)!;
    const rng = seededRng(31);
    const hand = seededRng(32);
    let coins = 0;
    let served = 0;
    const ids = new Set<number>();
    for (let t = SHOP_TICK_MS; t <= 40 * MIN; t += SHOP_TICK_MS) {
      const r = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const e of r.events) {
        if (e.t === 'order') served++;
      }
      for (const c of s.tavern.guests) ids.add(c.id);
      s = serveAll(s, hand);
      // The player clears a table every now and then.
      if (t % 20_000 === 0) {
        for (const m of s.tavern.mess) {
          const paid = collectCoins(s, m.id, t)!;
          coins += paid.coins;
          s = clearDish(paid.state, m.id)!;
        }
      }
      const both = s.tavern.guests.map((g) => g.id);
      expect(new Set(both).size).toBe(both.length);
    }
    expect(served).toBeGreaterThan(20);
    expect(coins).toBeGreaterThan(0);
    expect(s.ledger.filter((e) => e.reason === 'tavern').reduce((a, e) => a + e.goldDelta, 0)).toBe(coins);
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    // The tonic's tip came in too.
    expect(s.tavern.history.glowcap_tonic?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('guests: the away rule (step 9t)', () => {
  it('while the player is elsewhere at most 3 sit with an open order, and they never walk off', () => {
    let s = withLongTable(stock(withAle(), 'root_ale', 30));
    const events: TavernEvent[] = [];
    s = runTavern(s, 0, 30 * MIN, seededRng(17), false, (x, e) => {
      events.push(...e);
      expect(x.tavern.guests.length).toBeLessThanOrEqual(AWAY_ORDERS_MAX);
    });
    expect(openOrders(s.tavern).length).toBe(AWAY_ORDERS_MAX);
    expect(events.some((e) => e.t === 'unhappy')).toBe(false);
    for (const g of openOrders(s.tavern)) expect(g.patienceMs).toBe(GUEST_PATIENCE_MS);
    expect(s.player.wallet.gold).toBe(100);
    expect(s.tavern.mess).toEqual([]);
    // Back in the tavern the patience starts to run.
    s = runTavern(s, 30 * MIN, 5000, seededRng(18), true);
    expect(openOrders(s.tavern).every((g) => g.patienceMs < GUEST_PATIENCE_MS)).toBe(true);
  });

  it('after a closed game (maths only): up to 3 guests sit with an open order, nobody walks', () => {
    const s0 = withLongTable(stock(withAle(), 'root_ale', 30));
    const r = catchUpTavern(s0, tavernWorld(s0, false), 6 * 60 * MIN, seededRng(19));
    expect(r.arrived).toBe(AWAY_ORDERS_MAX);
    const s = r.state;
    expect(s.tavern.guests.length).toBe(AWAY_ORDERS_MAX);
    const seats = tavernSeats(s.items, s.tavern.roomId);
    for (const g of s.tavern.guests) {
      const seat = seats.find((k) => seatKey(k) === seatKey(g.seat!))!;
      expect(g).toMatchObject({ phase: 'order', seated: true, path: [], x: seat.x, y: seat.y, patienceMs: GUEST_PATIENCE_MS });
      expect(g.order?.item).toBe('root_ale');
    }
    expect(new Set(s.tavern.guests.map((g) => seatKey(g.seat!))).size).toBe(AWAY_ORDERS_MAX);
    expect(ale(s)).toBe(36 - AWAY_ORDERS_MAX);
    expect(s.player.wallet.gold).toBe(100);
    expect(s.tavern.updatedAt).toBe(6 * 60 * MIN);
    expect(s.player.materials).toEqual(ledgerMaterials(s));
    // Another long break changes nothing: they still wait.
    const again = catchUpTavern(s, tavernWorld(s, false), 20 * 60 * MIN, seededRng(20));
    expect(again.arrived).toBe(0);
    expect(again.state.tavern.guests).toEqual(s.tavern.guests);
    // A short break brings nobody yet (the first guests come after a moment).
    expect(catchUpTavern(s0, tavernWorld(s0, false), 3000, seededRng(19)).arrived).toBe(0);
  });

  it('a break while guests are in: who was eating has finished and left coins, who waits stays, the rest is gone', () => {
    const rng = seededRng(23);
    let s = withLongTable(stock(withAle(), 'root_ale', 30));
    let t = 0;
    // Until one guest eats while another still waits and someone is on the way in.
    for (; t < 20 * MIN; ) {
      t += SHOP_TICK_MS;
      s = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t).state;
      if (openOrders(s.tavern).length >= 2 && !s.tavern.guests.some((g) => g.phase === 'eat')) s = serveOne(s, rng);
      if (s.tavern.guests.some((g) => g.phase === 'eat') && openOrders(s.tavern).length > 0) break;
    }
    const eating = s.tavern.guests.filter((g) => g.phase === 'eat');
    const open = openOrders(s.tavern);
    expect(eating.length).toBe(1);
    expect(open.length).toBeGreaterThan(0);
    s = requestServe(s, open[0]!.id)!;
    // The save is closed and opened an hour later.
    const loaded = readSave(toSaveText(s, t));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const r = catchUpTavern(loaded.state, tavernWorld(loaded.state, false), t + 60 * MIN, seededRng(24)).state;
    expect(r.tavern.guests.every((g) => g.phase === 'order' && g.seated)).toBe(true);
    for (const g of open) expect(r.tavern.guests.some((x) => x.id === g.id)).toBe(true);
    expect(r.tavern.guests.length).toBeLessThanOrEqual(AWAY_ORDERS_MAX);
    expect(r.tavern.mess.map((m) => [m.seatUid, m.coins, m.dish])).toEqual([[eating[0]!.seat!.uid, 9, 'root_ale']]);
    expect(r.tavern.serveQueue).toEqual([]);
    expect(r.player.wallet.gold).toBe(100);
    expect(r.player.materials).toEqual(ledgerMaterials(r));
  });
});

/** The player serves the first open order only. */
function serveOne(s: GameState, rng: () => number): GameState {
  const g = openOrders(s.tavern)[0];
  const picked = g ? pickUpOrder(requestServe(s, g.id) ?? s) : null;
  return (picked && deliverOrder(picked.state, rng)?.state) ?? s;
}
