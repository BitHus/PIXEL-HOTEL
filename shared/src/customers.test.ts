import { describe, expect, it } from 'vitest';
import {
  HURRIED_BROWSE_MAX_MS,
  HURRIED_BROWSE_MIN_MS,
  HURRIED_SPEED_BONUS,
  CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_BROWSE_MAX_MS,
  CUSTOMER_BROWSE_MIN_MS,
  CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_MAX_IN_SHOP,
  CUSTOMER_WALK_SPEED,
  HOTEL_WALK_SPEED,
  LOOK_COLORS,
  QUEUE_MAX,
  QUEUE_MIN_GAP_PX,
  SHOP_TICK_MS,
} from './config.ts';
import { buyerCount, catchUpShop, customerLook, findCounter, queueSpots, stepShop, waitingCount, type Customer, type ShopEvent, type ShopWorld } from './customers.ts';
import { inStaffZone, npcGrid, planKey, staffZones } from './customerPlan.ts';
import { NPC_LINES } from './npcTalk.ts';
import { selectableClothing } from './clothing.ts';
import { behindPoint, behindReachable, canPlace, getFurnitureType, itemBlockers, staffZone } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { putOnShelf } from './shop.ts';
import { applyChange } from './ledger.ts';
import { ledgerGold } from './testState.ts';

let gridFor: { items: GameState['items']; grid: ShopWorld['grid'] } | null = null;

/** The shop world; the nav grid is only rebuilt when the items changed (like LocalGameAPI does). */
function world(s: GameState, cashier = true): ShopWorld {
  const room = s.rooms.find((r) => r.id === s.shop.roomId)!;
  if (gridFor?.items !== s.items) gridFor = { items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)) };
  return { room, items: s.items, grid: gridFor.grid, cashier };
}

/** Puts wood back on every empty slot of the stall table (price 1). */
function restock(s: GameState, t: number): GameState {
  const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
  for (let index = 0; index < 3; index++) {
    if (!s.shop.slots.some((x) => x.shelfUid === shelf.uid && x.index === index)) s = putOnShelf(s, { shelfUid: shelf.uid, index }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
  }
  return s;
}

function withItem(s: GameState, uid: number, typeId: string, x: number, y: number): GameState {
  return { ...s, items: [...s.items, { uid, typeId, ownerId: 1, roomId: s.shop.roomId, x, y, facing: 'down', onItemUid: null }] };
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
    // With the fine nav grid two spots are still never on top of each other.
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y)).toBeGreaterThanOrEqual(QUEUE_MIN_GAP_PX);
    // The paying spot is just in front of the counter.
    expect(spots[0]).toEqual({ x: counter.x, y: counter.y + 24 });
  });

  it('the catch-up after a break sells nothing and fills the line, at most QUEUE_MAX, at the queue spots', () => {
    let s = stocked(3, 30);
    const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
    const gold = s.player.wallet.gold;
    const ledger = s.ledger.length;
    const r = catchUpShop(s, world(s), 8 * 3600_000, seededRng(3));
    expect(r.state.player.wallet.gold).toBe(gold);
    expect(r.state.ledger.length).toBe(ledger);
    expect(r.state.ledger.some((e) => e.reason === 'sale')).toBe(false);
    const line = r.state.shop.customers;
    expect(line.length).toBe(QUEUE_MAX);
    expect(waitingCount(line)).toBe(QUEUE_MAX);
    const counter = findCounter(s.items, s.shop.roomId)!;
    const spots = queueSpots(world(s).grid, world(s).room, counter, QUEUE_MAX);
    line.forEach((c, k) => {
      expect(c.queueSpot).toBe(k);
      expect({ x: c.x, y: c.y }).toEqual(spots[k]);
      expect(c.path).toEqual([]);
      expect(c.phase).toBe(k === 0 ? 'pay' : 'queue');
    });
    // The bought items left the slots: 3 were for sale, 3 wait at the till.
    expect(r.state.shop.slots.filter((x) => x.loot && x.shelfUid === shelf.uid)).toHaveLength(0);
    expect(r.state.shop.updatedAt).toBe(8 * 3600_000);
    expect(r.arrived).toBe(QUEUE_MAX);
  });

  it('the catch-up keeps the customers already carrying something and drops the others', () => {
    let s = stocked(3);
    const rng = seededRng(5);
    const w = world(s);
    let t = 0;
    for (; t < 120_000 && !s.shop.customers.some((c) => c.carrying !== null); t += SHOP_TICK_MS) {
      s = stepShop(s, { ...w, items: s.items }, SHOP_TICK_MS, rng, t).state;
    }
    const carrier = s.shop.customers.find((c) => c.carrying !== null)!;
    expect(carrier).toBeDefined();
    // A gap too short for anyone new.
    const r = catchUpShop(s, world(s), s.shop.updatedAt, seededRng(9));
    expect(r.state.shop.customers.map((c) => c.id)).toEqual([carrier.id]);
    expect(r.state.shop.customers[0]).toMatchObject({ phase: 'pay', queueSpot: 0, carrying: carrier.carrying });
    expect(r.state.player.wallet.gold).toBe(s.player.wallet.gold);
  });

  it('a full line stays full without the player: nobody leaves, no new buyer comes', () => {
    let s = stocked(3, 30);
    const r = catchUpShop(s, world(s), 8 * 3600_000, seededRng(3));
    s = r.state;
    const ids = s.shop.customers.map((c) => c.id);
    const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
    for (let index = 0; index < 3; index++) s = putOnShelf(s, { shelfUid: shelf.uid, index }, { kind: 'material', id: 'wood' }, 1, 0)!;
    const rng = seededRng(4);
    for (let t = 0; t < 30 * 60_000; t += SHOP_TICK_MS) s = stepShop(s, world(s, false), SHOP_TICK_MS, rng, 8 * 3600_000 + t).state;
    // Window-shoppers may still walk in and out; the line is the same three.
    expect(s.shop.customers.filter((c) => c.carrying !== null).map((c) => c.id)).toEqual(ids);
    expect(buyerCount(s.shop.customers)).toBe(QUEUE_MAX);
    expect(s.shop.slots.filter((x) => x.loot)).toHaveLength(3);
    expect(s.player.wallet.gold).toBe(r.state.player.wallet.gold);
  });

  it('customer looks use only free clothing and LOOK_COLORS, and are the same for the same id', () => {
    for (let id = -1; id > -60; id--) {
      const l = customerLook(id);
      expect(customerLook(id)).toEqual(l);
      expect(LOOK_COLORS.skin).toContain(l.skin);
      expect(LOOK_COLORS.hair).toContain(l.hair);
      expect(LOOK_COLORS.top).toContain(l.shirt);
      expect(LOOK_COLORS.bottoms).toContain(l.legs);
      expect(LOOK_COLORS.shoes).toContain(l.shoes);
      expect(selectableClothing('hair').map((c) => c.id)).toContain(l.hairStyle);
      expect(selectableClothing('top').map((c) => c.id)).toContain(l.top);
      expect(selectableClothing('bottoms').map((c) => c.id)).toContain(l.bottoms);
    }
    const looks = new Set(Array.from({ length: 20 }, (_, k) => JSON.stringify(customerLook(-1 - k))));
    expect(looks.size).toBeGreaterThan(10);
  });

  it('the customer at the till calls out when nobody serves, and customers talk sometimes', () => {
    let s = stocked(3, 30);
    const rng = seededRng(11);
    const said: string[] = [];
    let t = 0;
    for (; t < 20 * 60_000; t += SHOP_TICK_MS) {
      const r = stepShop(s, world(s, false), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const e of r.events) if (e.t === 'say') said.push(e.text);
    }
    expect(said.length).toBeGreaterThan(0);
    for (const x of said) expect(x.length).toBeLessThanOrEqual(40);
    expect(said.some((x) => ['Hello? Anyone here?', 'Shopkeeper? I\'d like to pay!', 'Is anybody minding the till?', 'I\'ll just wait here then...', 'Hellooo? Customer here!', 'Ahem! Ready to pay!', 'Should I ring a bell?'].includes(x))).toBe(true);
    // Never the same line twice in a row for a moment.
    expect(Object.keys(s.shop.lastLines).length).toBeGreaterThan(0);
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
    // Nobody serves: the line fills up to QUEUE_MAX and stays full.
    expect(waitingCount(s.shop.customers)).toBe(QUEUE_MAX);
  });

  it('customers take their time: calm speed, a stop inside the door, 2 to 5 s browsing, a wait after paying', () => {
    let s = stocked(3, 40);
    const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
    const rng = seededRng(21);
    const seen = new Map<number, { speeds: number; hurried: boolean; enterMs: number; thinking: number[]; paidMs: number }>();
    let t = 0;
    for (; t < 900_000; t += SHOP_TICK_MS) {
      const free = [0, 1, 2].find((index) => !s.shop.slots.some((x) => x.index === index));
      if (free !== undefined) s = putOnShelf(s, { shelfUid: shelf.uid, index: free }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
      const r = stepShop(s, world(s, true), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const c of s.shop.customers) {
        if (c.followId !== null) continue; // a friend walks at the speed of the one they came with
        const k = seen.get(c.id) ?? { speeds: c.speed, hurried: c.kind === 'hurried', enterMs: 0, thinking: [], paidMs: 0 };
        if (c.phase === 'enter' && c.path.length === 0) k.enterMs += SHOP_TICK_MS;
        if (c.phase === 'paid') k.paidMs += SHOP_TICK_MS;
        seen.set(c.id, k);
      }
      for (const e of r.events) if (e.t === 'thinking') seen.get(e.customerId)?.thinking.push(e.ms);
      if (seen.size >= 12) break;
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    const speeds = [...seen.values()].map((k) => k.speeds);
    for (const k of seen.values()) {
      // Hurried customers walk HURRIED_SPEED_BONUS faster (still slower than the player).
      const f = k.hurried ? 1 + HURRIED_SPEED_BONUS : 1;
      expect(k.speeds).toBeGreaterThanOrEqual(CUSTOMER_WALK_SPEED * 0.9 * f - 1e-9);
      expect(k.speeds).toBeLessThanOrEqual(CUSTOMER_WALK_SPEED * 1.1 * f + 1e-9);
      expect(k.speeds).toBeLessThan(HOTEL_WALK_SPEED);
    }
    expect([...seen.values()].some((k) => k.hurried)).toBe(true);
    expect([...seen.values()].some((k) => !k.hurried)).toBe(true);
    expect(new Set(speeds).size).toBeGreaterThan(1);
    const done = [...seen.values()].filter((k) => k.thinking.length > 0);
    for (const k of done) {
      expect(k.enterMs).toBeGreaterThanOrEqual(CUSTOMER_ENTER_PAUSE_MS - SHOP_TICK_MS);
      for (const ms of k.thinking) {
        expect(ms).toBeGreaterThanOrEqual(k.hurried ? HURRIED_BROWSE_MIN_MS : CUSTOMER_BROWSE_MIN_MS);
        expect(ms).toBeLessThanOrEqual(k.hurried ? HURRIED_BROWSE_MAX_MS : CUSTOMER_BROWSE_MAX_MS);
      }
      expect(k.thinking.length).toBeLessThanOrEqual(4);
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

  it('STAFF ONLY: customers never walk or stand behind the counter, also for a decoration there', () => {
    let s = stocked(3, 200);
    const counter = findCounter(s.items, s.shop.roomId)!;
    const zone = staffZone(counter, getFurnitureType('counter'));
    // The player's serving spot is in the zone; a plant stands right behind the counter, in it.
    const serve = behindPoint(counter, getFurnitureType('counter'));
    expect(inStaffZone([zone], serve)).toBe(true);
    s = withItem(s, 77, 'plant', counter.x + 40, counter.y - 40);
    expect(staffZones(s.items, s.shop.roomId)).toEqual([zone]);
    const rng = seededRng(31);
    let looked = 0;
    let steps = 0;
    for (let t = 0; t < 1_800_000; t += SHOP_TICK_MS) {
      s = restock(s, t);
      s = stepShop(s, world(s, t % 60_000 < 20_000), SHOP_TICK_MS, rng, t).state;
      for (const c of s.shop.customers) {
        steps++;
        // Strictly inside the zone = behind the counter.
        const inside = c.x > zone.x && c.x < zone.x + zone.w && c.y > zone.y && c.y < zone.y + zone.h;
        expect(inside, `customer ${c.id} (${c.phase}) at ${c.x},${c.y}`).toBe(false);
        if (c.phase === 'act' && c.doing === 'decor' && c.browsing && c.decorUid === 77) {
          looked++;
          // On the customer side, never on the serving spot.
          expect(Math.hypot(c.x - serve.x, c.y - serve.y)).toBeGreaterThan(8);
        }
      }
    }
    expect(steps).toBeGreaterThan(1000);
    expect(looked).toBeGreaterThan(0);
    // The customers' grid has the zone blocked, the player's grid has not.
    const w = world(s);
    const g = npcGrid(w.grid, [zone]);
    const cell = cellAt(w.grid, serve);
    expect(isCellFree(w.grid, cell.c, cell.r)).toBe(true);
    expect(isCellFree(g, cell.c, cell.r)).toBe(false);
  });

  it('natural customers: different plans, all the small behaviours, never the same plan twice in a row', () => {
    let s = stocked(3, 400);
    s = withItem(s, 77, 'plant', 470, 250);
    s = withItem(s, 78, 'plant', 100, 250);
    s = withItem(s, 88, 'bench', 420, 120);
    const rng = seededRng(12);
    const plans = new Map<number, string>();
    const done = new Set<string>();
    const decors = new Set<number>();
    let t = 0;
    for (; t < 3_600_000 && plans.size < 60; t += SHOP_TICK_MS) {
      s = restock(s, t);
      if (s.shop.nextCustomerInMs > 8000) s = { ...s, shop: { ...s.shop, nextCustomerInMs: 8000 } };
      s = stepShop(s, world(s, true), SHOP_TICK_MS, rng, t).state;
      expect(s.shop.customers.length).toBeLessThanOrEqual(CUSTOMER_MAX_IN_SHOP);
      expect(buyerCount(s.shop.customers)).toBeLessThanOrEqual(QUEUE_MAX);
      for (const c of s.shop.customers) {
        if (c.followId === null && !plans.has(c.id)) plans.set(c.id, planKey(c.plan));
        if (c.phase === 'act' && c.browsing && c.doing) {
          done.add(c.doing);
          if (c.doing === 'decor' && c.decorUid !== null) decors.add(c.decorUid);
          if (c.doing === 'sit') expect(c.seat?.uid).toBe(88);
        }
      }
    }
    expect(plans.size).toBeGreaterThanOrEqual(40);
    // Ids go down: in the order they came, no two in a row have the same plan.
    const order = [...plans.entries()].sort((a, b) => b[0] - a[0]).map((e) => e[1]);
    for (let i = 1; i < order.length; i++) expect(order[i], `visitor ${i}`).not.toBe(order[i - 1]);
    expect(new Set(order).size).toBeGreaterThan(10);
    // Everything happens some time, and not always the same decoration.
    expect([...done].sort()).toEqual(['decor', 'goods', 'remark', 'sit', 'talk', 'wander']);
    expect(decors).toEqual(new Set([77, 78]));
  });

  it('window-shoppers look around and leave: no reaction, nothing bought, not counted for the line', () => {
    let s = stocked(3, 400);
    const rng = seededRng(14);
    const windowIds = new Set<number>();
    const gone = new Set<number>();
    const reacted = new Set<number>();
    for (let t = 0; t < 2_400_000 && gone.size < 8; t += SHOP_TICK_MS) {
      s = restock(s, t);
      const before = s.shop.customers;
      const r = stepShop(s, world(s, false), SHOP_TICK_MS, rng, t);
      s = r.state;
      for (const e of r.events) if (e.t === 'reaction') reacted.add(e.customerId);
      for (const c of s.shop.customers) {
        if (!c.buys) {
          windowIds.add(c.id);
          expect(c.carrying).toBeNull();
          expect(['enter', 'act', 'follow', 'leave']).toContain(c.phase);
        }
      }
      for (const b of before) if (!b.buys && !s.shop.customers.some((c) => c.id === b.id)) gone.add(b.id);
      // Nobody serves: the line fills, and window-shoppers still come and go.
      expect(waitingCount(s.shop.customers)).toBeLessThanOrEqual(QUEUE_MAX);
      expect(s.shop.customers.length).toBeLessThanOrEqual(CUSTOMER_MAX_IN_SHOP);
    }
    expect(gone.size).toBeGreaterThanOrEqual(8);
    for (const id of windowIds) expect(reacted.has(id)).toBe(false);
    expect(waitingCount(s.shop.customers)).toBe(QUEUE_MAX);
  });

  it('two customers talk: they face each other and 2 to 3 bubbles go back and forth; pairs stay together', () => {
    let s = stocked(3, 400);
    const rng = seededRng(17);
    const small = new Set([...NPC_LINES.smalltalk, ...NPC_LINES.smalltalk_reply, ...NPC_LINES.smalltalk_end]);
    let talks = 0;
    let pairs = 0;
    let nearTicks = 0;
    let pairTicks = 0;
    const speakers = new Map<number, Set<number>>();
    for (let t = 0; t < 3_600_000 && (talks < 6 || pairs < 3); t += SHOP_TICK_MS) {
      s = restock(s, t);
      if (s.shop.nextCustomerInMs > 6000) s = { ...s, shop: { ...s.shop, nextCustomerInMs: 6000 } };
      const before = s.shop.customers;
      const r = stepShop(s, world(s, true), SHOP_TICK_MS, rng, t);
      s = r.state;
      const byId = new Map<number, Customer>(s.shop.customers.map((c) => [c.id, c]));
      for (const c of s.shop.customers) {
        const was = before.find((b) => b.id === c.id);
        if (c.talk && c.talk.left > 0 && !(was?.talk && was.talk.left > 0)) {
          // The talk starts: 2 to 3 lines, the other one is held and they face each other.
          talks++;
          expect(c.talk.left).toBeGreaterThanOrEqual(2);
          expect(c.talk.left).toBeLessThanOrEqual(3);
          const o = byId.get(c.talk.withId)!;
          expect(o.holdMs).toBeGreaterThan(0);
          const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' } as const;
          if (Math.abs(o.x - c.x) < 1 || Math.abs(o.y - c.y) < 1) expect(o.facing).toBe(opposite[c.facing]);
          speakers.set(c.id, new Set());
        }
        if (c.followId !== null) {
          if (!before.some((b) => b.id === c.id)) pairs++;
          const lead = byId.get(c.followId);
          if (lead && c.path.length === 0 && lead.path.length === 0 && c.phase === 'follow' && lead.phase !== 'enter') {
            pairTicks++;
            if (Math.hypot(lead.x - c.x, lead.y - c.y) <= 48) nearTicks++;
          }
        }
      }
      for (const e of r.events) {
        if (e.t !== 'say' || !small.has(e.text)) continue;
        for (const [a, set] of speakers) {
          const c = byId.get(a);
          if (c?.talk && (e.customerId === a || e.customerId === c.talk.withId)) set.add(e.customerId);
        }
      }
    }
    expect(talks).toBeGreaterThanOrEqual(6);
    expect(pairs).toBeGreaterThanOrEqual(3);
    // Both sides speak in most talks.
    expect([...speakers.values()].filter((set) => set.size === 2).length).toBeGreaterThan(talks / 2);
    // A friend standing still is near the one they came with almost always.
    expect(pairTicks).toBeGreaterThan(0);
    expect(nearTicks / pairTicks).toBeGreaterThan(0.9);
  });

  it('a waiting customer may sit on a free seat near the line, and stands up for the till', () => {
    let s = stocked(3, 30);
    const room = s.rooms.find((r) => r.id === s.shop.roomId)!;
    const counter = findCounter(s.items, room.id)!;
    // A bench next to the queue row, below the counter.
    const spot = { x: counter.x + 32, y: counter.y + 80 };
    expect(canPlace(room, s.items, getFurnitureType('bench'), spot.x, spot.y, 'down')).toBe(true);
    s = { ...s, items: [...s.items, { uid: 88, typeId: 'bench', ownerId: 1, roomId: room.id, x: spot.x, y: spot.y, facing: 'down', onItemUid: null }] };
    const rng = seededRng(6);
    let sat = false;
    let stoodUpToPay = false;
    let sitter: number | null = null;
    for (let t = 0; t < 3_000_000 && !stoodUpToPay; t += SHOP_TICK_MS) {
      const serve = sat && t % 120_000 < 20_000;
      s = stepShop(s, world(s, serve), SHOP_TICK_MS, rng, t).state;
      for (const c of s.shop.customers) {
        if (c.seat && c.path.length === 0) {
          if (c.phase === 'queue') {
            sat = true;
            sitter = c.id;
          }
          expect(c.seat.uid).toBe(88);
          if (c.phase !== 'queue') continue; // a visitor sitting for a moment (the 'sit' behaviour)
          expect(c.queueSpot).toBeGreaterThan(0);
        }
        if (c.id === sitter && c.phase === 'pay' && !c.seat) stoodUpToPay = true;
      }
      // Two customers never share a seat.
      const seats = s.shop.customers.flatMap((c) => (c.seat ? [`${c.seat.uid}:${c.seat.index}`] : []));
      expect(new Set(seats).size).toBe(seats.length);
      const shelf = s.items.find((i) => i.typeId === 'stall_table')!;
      const free = [0, 1, 2].find((index) => !s.shop.slots.some((x) => x.index === index));
      if (free !== undefined) s = putOnShelf(s, { shelfUid: shelf.uid, index: free }, { kind: 'material', id: 'wood' }, 1, t) ?? s;
    }
    expect(sat).toBe(true);
    expect(stoodUpToPay).toBe(true);
  });
});
