import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_BROWSE_MAX_MS,
  CUSTOMER_BROWSE_MIN_MS,
  CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_MAX_IN_SHOP,
  CUSTOMER_WALK_SPEED,
  HOTEL_WALK_SPEED,
  QUEUE_MAX,
  SHOP_TICK_MS,
} from './config.ts';
import { findCounter, queueSpots, settleCustomers, stepShop, type ShopEvent, type ShopWorld } from './customers.ts';
import { behindPoint, behindReachable, canPlace, getFurnitureType, itemBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { putOnShelf } from './shop.ts';
import { applyChange } from './ledger.ts';
import { ledgerGold } from './testState.ts';

function world(s: GameState, cashier = true): ShopWorld {
  const room = s.rooms.find((r) => r.id === s.shop.roomId)!;
  return { room, items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)), cashier };
}

/** A new player with n wood (n <= 3) on the stall_table at price 1 (everyone who wants materials buys). */
function stocked(n: number, extraWood = 0): GameState {
  let s = createNewPlayer(undefined, 0);
  if (extraWood) s = applyChange(s, { reason: 'debug', materials: { wood: extraWood } }, 0)!;
  const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
  for (let index = 0; index < n; index++) s = putOnShelf(s, { shelfUid: shelf.uid, index }, { kind: 'material', id: 'wood' }, 1, 0)!;
  return s;
}

function run(s: GameState, ms: number, rng: () => number, each?: (s: GameState, e: ShopEvent[]) => void): GameState {
  const w = world(s);
  for (let t = 0; t < ms; t += SHOP_TICK_MS) {
    const r = stepShop(s, { ...w, items: s.items }, SHOP_TICK_MS, rng, t);
    s = r.state;
    each?.(s, r.events);
  }
  return s;
}

describe('walking customers', () => {
  it('nobody comes while the shop has no stock', () => {
    const s = run(createNewPlayer(undefined, 0), 60_000, seededRng(1));
    expect(s.shop.customers).toEqual([]);
  });

  it('gold only goes up when the customer pays at the till', () => {
    let s = stocked(3);
    const start = s.player.wallet.gold;
    let tookAt = -1;
    let paidAt = -1;
    let t = 0;
    s = run(s, 120_000, seededRng(5), (st, events) => {
      t += SHOP_TICK_MS;
      for (const e of events) {
        if (e.t === 'slots' && tookAt < 0) {
          tookAt = t;
          // The item left the slot, but no gold yet.
          expect(st.player.wallet.gold).toBe(start);
          expect(st.shop.customers.some((c) => c.carrying !== null)).toBe(true);
        }
        if (e.t === 'sale' && paidAt < 0) {
          paidAt = t;
          expect(st.player.wallet.gold).toBe(start + e.price);
        }
      }
      if (tookAt > 0 && paidAt < 0) expect(st.player.wallet.gold).toBe(start);
    });
    expect(tookAt).toBeGreaterThan(0);
    expect(paidAt).toBeGreaterThan(tookAt);
    expect(s.ledger.filter((e) => e.reason === 'sale').length).toBeGreaterThan(0);
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  });

  it('the queue never puts two customers on the same spot', () => {
    let s = stocked(3);
    const rng = seededRng(9);
    let maxLine = 0;
    const w = world(s);
    for (let t = 0; t < 240_000; t += SHOP_TICK_MS) {
      // Keep the table full and customers coming every 2 s so a line forms.
      if (s.shop.slots.length < 3) {
        const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
        s = applyChange(s, { reason: 'debug', materials: { wood: 1 } }, t)!;
        const free = [0, 1, 2].find((index) => !s.shop.slots.some((x) => x.index === index))!;
        s = putOnShelf(s, { shelfUid: shelf.uid, index: free }, { kind: 'material', id: 'wood' }, 1, t)!;
      }
      if (s.shop.nextCustomerInMs > 2000) s = { ...s, shop: { ...s.shop, nextCustomerInMs: 2000 } };
      s = stepShop(s, { ...w, items: s.items }, SHOP_TICK_MS, rng, t).state;
      const line = s.shop.customers.filter((c) => c.phase === 'queue' || c.phase === 'pay');
      maxLine = Math.max(maxLine, line.length);
      expect(new Set(line.map((c) => c.queueSpot)).size).toBe(line.length);
      expect(line.filter((c) => c.phase === 'pay').length).toBeLessThanOrEqual(1);
      for (const c of line.filter((c) => c.phase === 'pay')) expect(c.queueSpot).toBe(0);
    }
    expect(maxLine).toBeGreaterThanOrEqual(2);
  });

  it('queue spots are different free cells reachable from the door', () => {
    const s = createNewPlayer(undefined, 0);
    const w = world(s);
    const counter = findCounter(s.items, s.shop.roomId)!;
    const spots = queueSpots(w.grid, w.room, counter, 8);
    expect(spots).toHaveLength(8);
    const cells = spots.map((p) => cellAt(w.grid, p));
    for (const c of cells) expect(isCellFree(w.grid, c.c, c.r)).toBe(true);
    expect(new Set(cells.map((c) => `${c.c},${c.r}`)).size).toBe(8);
    // The paying spot is just in front of the counter.
    expect(spots[0]).toEqual({ x: counter.x, y: counter.y + 24 });
  });

  it('settling pays for carried items at once and empties the shop floor', () => {
    let s = stocked(3);
    let carrying = false;
    const rng = seededRng(5);
    const w = world(s);
    for (let t = 0; t < 120_000 && !carrying; t += SHOP_TICK_MS) {
      s = stepShop(s, { ...w, items: s.items }, SHOP_TICK_MS, rng, t).state;
      carrying = s.shop.customers.some((c) => c.carrying !== null);
    }
    expect(carrying).toBe(true);
    const gold = s.player.wallet.gold;
    const r = settleCustomers(s, 1);
    expect(r.state.shop.customers).toEqual([]);
    expect(r.sales.length).toBeGreaterThan(0);
    expect(r.state.player.wallet.gold).toBe(gold + r.sales.reduce((a, x) => a + x.price, 0));
  });

  it('a customer at the till only pays while the player stands behind the counter', () => {
    let s = stocked(3);
    const rng = seededRng(5);
    let t = 0;
    const step = (cashier: boolean): ShopEvent[] => {
      t += SHOP_TICK_MS;
      const r = stepShop(s, world(s, cashier), SHOP_TICK_MS, rng, t);
      s = r.state;
      return r.events;
    };
    for (let k = 0; k < 2000 && !s.shop.customers.some((c) => c.phase === 'pay'); k++) step(false);
    expect(s.shop.customers.some((c) => c.phase === 'pay')).toBe(true);
    const gold = s.player.wallet.gold;
    for (let k = 0; k < 600; k++) expect(step(false).some((e) => e.t === 'sale')).toBe(false);
    expect(s.player.wallet.gold).toBe(gold);
    const events: ShopEvent[] = [];
    for (let k = 0; k < 20; k++) events.push(...step(true));
    expect(events.map((e) => e.t)).toContain('paying');
    expect(events.map((e) => e.t)).toContain('sale');
    expect(s.player.wallet.gold).toBeGreaterThan(gold);
  });

  it('no new customers come in while the line at the till is full', () => {
    let s = stocked(3, 30);
    const rng = seededRng(2);
    const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
    for (let t = 0; t < 600_000; t += SHOP_TICK_MS) {
      if (s.shop.slots.length < 3) {
        const free = [0, 1, 2].find((index) => !s.shop.slots.some((x) => x.index === index))!;
        s = putOnShelf(s, { shelfUid: shelf.uid, index: free }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
      }
      s = stepShop(s, world(s, false), SHOP_TICK_MS, rng, t).state;
      expect(s.shop.customers.filter((c) => c.carrying !== null).length).toBeLessThanOrEqual(QUEUE_MAX);
      expect(s.shop.customers.length).toBeLessThanOrEqual(CUSTOMER_MAX_IN_SHOP);
    }
    // Nobody serves: the shop fills up to its limit and stays full.
    expect(s.shop.customers.length).toBe(CUSTOMER_MAX_IN_SHOP);
  });

  it('customers take their time: calm speed, a stop inside the door, 2 to 5 s browsing, a wait after paying', () => {
    let s = stocked(3, 40);
    const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
    const rng = seededRng(21);
    const seen = new Map<number, { speeds: number; enterMs: number; thinking: number[]; paidMs: number }>();
    let t = 0;
    for (; t < 900_000; t += SHOP_TICK_MS) {
      const free = [0, 1, 2].find((index) => !s.shop.slots.some((x) => x.index === index));
      if (free !== undefined) s = putOnShelf(s, { shelfUid: shelf.uid, index: free }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
      const r = stepShop(s, world(s, true), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const c of s.shop.customers) {
        const k = seen.get(c.id) ?? { speeds: c.speed, enterMs: 0, thinking: [], paidMs: 0 };
        if (c.phase === 'enter' && c.path.length === 0) k.enterMs += SHOP_TICK_MS;
        if (c.phase === 'paid') k.paidMs += SHOP_TICK_MS;
        seen.set(c.id, k);
      }
      for (const e of r.events) if (e.t === 'thinking') seen.get(e.customerId)?.thinking.push(e.ms);
      if (seen.size >= 12) break;
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    const speeds = [...seen.values()].map((k) => k.speeds);
    for (const v of speeds) {
      expect(v).toBeGreaterThanOrEqual(CUSTOMER_WALK_SPEED * 0.9 - 1e-9);
      expect(v).toBeLessThanOrEqual(CUSTOMER_WALK_SPEED * 1.1 + 1e-9);
      expect(v).toBeLessThan(HOTEL_WALK_SPEED);
    }
    expect(new Set(speeds).size).toBeGreaterThan(1);
    const done = [...seen.values()].filter((k) => k.thinking.length > 0);
    for (const k of done) {
      expect(k.enterMs).toBeGreaterThanOrEqual(CUSTOMER_ENTER_PAUSE_MS - SHOP_TICK_MS);
      for (const ms of k.thinking) {
        expect(ms).toBeGreaterThanOrEqual(CUSTOMER_BROWSE_MIN_MS);
        expect(ms).toBeLessThanOrEqual(CUSTOMER_BROWSE_MAX_MS);
      }
      expect(k.thinking.length).toBeLessThanOrEqual(2);
    }
    // Every buyer waits a moment at the till after paying.
    const payers = [...seen.values()].filter((k) => k.paidMs > 0);
    expect(payers.length).toBeGreaterThan(0);
    for (const k of payers) expect(k.paidMs).toBeGreaterThanOrEqual(CUSTOMER_AFTER_PAY_MS - SHOP_TICK_MS);
  });


  it('the shop starts with a reachable spot behind the counter', () => {
    const s = createNewPlayer(undefined, 0);
    const w = world(s);
    const counter = findCounter(s.items, s.shop.roomId)!;
    const spot = behindPoint(counter, getFurnitureType('counter'));
    expect(spot.y).toBeLessThan(counter.y - 40);
    expect(behindReachable(w.room, itemBlockers(s.items, w.room.id), spot)).toBe(true);
  });

  it('with stock on two items, some customers look at the second one before deciding', () => {
    let s = stocked(3, 40);
    const room = s.rooms.find((r) => r.id === s.shop.roomId)!;
    expect(canPlace(room, s.items, getFurnitureType('display_case'), 440, 184, 'down')).toBe(true);
    s = { ...s, items: [...s.items, { uid: 99, typeId: 'display_case', ownerId: 1, roomId: room.id, x: 440, y: 184, facing: 'down', onItemUid: null }] };
    const table = s.items.find((i) => i.typeId === 'stall_table')!;
    const rng = seededRng(4);
    const looks = new Map<number, number>();
    for (let t = 0; t < 1_200_000 && looks.size < 30; t += SHOP_TICK_MS) {
      for (const [uid, n] of [[table.uid, 3], [99, 4]] as const) {
        const free = Array.from({ length: n }, (_, i) => i).find((index) => !s.shop.slots.some((x) => x.shelfUid === uid && x.index === index));
        if (free !== undefined) s = putOnShelf(s, { shelfUid: uid, index: free }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
      }
      s = stepShop(s, world(s, true), SHOP_TICK_MS, rng, t).state;
      for (const c of s.shop.customers) looks.set(c.id, Math.max(looks.get(c.id) ?? 0, c.looks));
    }
    const counts = [...looks.values()];
    expect(counts.some((n) => n === 2)).toBe(true);
    expect(counts.some((n) => n === 1)).toBe(true);
    expect(counts.every((n) => n <= 2)).toBe(true);
  });
});

