import { describe, expect, it } from 'vitest';
import { SHOP_TICK_MS } from './config.ts';
import { findCounter, queueSpots, settleCustomers, stepShop, type ShopEvent, type ShopWorld } from './customers.ts';
import { itemBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { putOnShelf } from './shop.ts';
import { applyChange } from './ledger.ts';
import { ledgerGold } from './testState.ts';

function world(s: GameState): ShopWorld {
  const room = s.rooms.find((r) => r.id === s.shop.roomId)!;
  return { room, items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)) };
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
});
