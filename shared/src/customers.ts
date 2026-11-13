// Walking shop customers (step 7). Pure: time (dtMs, at) and rng are passed in.
//
// Flow: a customer appears below the door and walks in to the table, shelf or case that holds
// the cheapest item of the category they want, and decides there (the reaction bubble). If they
// buy, the item leaves the slot at once and they carry it to the customer side of the counter.
// Customers wait in a queue line: spot 0 is the paying spot in front of the counter, the others
// are in a row behind it (queueSpots; every spot is a different free nav cell). The one on spot
// 0 waits until the player stands behind the counter (ShopWorld.cashier), then pays
// (CUSTOMER_PAY_MS, the till animation): only then the gold comes in (ledger reason 'sale'). Then
// they walk out through the door. A customer who refuses (or finds nothing) just leaves. While
// QUEUE_MAX customers carry something to the till, no new customers come in.

import { getFurnitureType, doorPoint, standPointFor } from './furniture.ts';
import {
  CUSTOMER_DECIDE_MS,
  CUSTOMER_LOOKS,
  CUSTOMER_OUTSIDE_PX,
  CUSTOMER_PAY_MS,
  HOTEL_WALK_SPEED,
  QUEUE_MAX,
  QUEUE_SPACING_PX,
} from './config.ts';
import { walkAvatar, type Avatar, type AvatarLook } from './avatar.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { cellAt, cellCenter, findPath, isCellFree, reachableCells, type NavGrid } from './nav.ts';
import type { Room } from './room.ts';
import { rngPick } from './rng.ts';
import {
  chooseCategory,
  customerIntervalMs,
  hasStock,
  lootTypeId,
  recordSale,
  removeSlot,
  rollTolerance,
  shopAppeal,
  visit,
  type ShopState,
} from './shop.ts';
import type { Facing, FurnitureItem, LootRef, Point, Reaction, Rng, SaleRecord, ShopCategory } from './types.ts';

export type CustomerPhase = 'browse' | 'decide' | 'queue' | 'pay' | 'leave';

export interface Customer {
  /** Negative ids (players are positive). */
  id: number;
  look: AvatarLook;
  x: number;
  y: number;
  facing: Facing;
  /** Points still to walk to (empty = standing). */
  path: Point[];
  phase: CustomerPhase;
  want: ShopCategory;
  tolerance: number;
  /** ms left standing in 'decide' or 'pay'. */
  waitMs: number;
  /** What they bought and carry to the till. */
  carrying: { loot: LootRef; price: number } | null;
  reaction: Reaction | null;
  /** Queue spot (0 = paying spot) while in 'queue' or 'pay', else -1. */
  queueSpot: number;
}

export type ShopEvent =
  /** The customer list changed (someone came, left, or got a new path). */
  | { t: 'customers'; customers: Customer[] }
  | { t: 'reaction'; customerId: number; reaction: Reaction }
  /** The player is behind the counter and this customer starts paying (the till animation). */
  | { t: 'paying'; customerId: number; till: Point }
  /** A customer paid at the till: the gold is in the wallet now. */
  | { t: 'sale'; customerId: number; typeId: string; price: number; till: Point }
  /** Slot contents changed (a customer took an item). */
  | { t: 'slots' };

/** The counter in the shop room (there is always exactly one). */
export function findCounter(items: readonly FurnitureItem[], roomId: number): FurnitureItem | undefined {
  return items.find((i) => i.roomId === roomId && i.typeId === 'counter');
}

/** Where customers appear and disappear: below the door, outside the floor. */
export function outsidePoint(room: Room): Point {
  return { x: room.w / 2, y: room.h + CUSTOMER_OUTSIDE_PX };
}

/**
 * n queue spots: the paying spot on the customer side of the counter (its stand point), then a
 * row going away from the counter, QUEUE_SPACING_PX apart. Each spot is in a different free nav
 * cell that can be reached from the door; a spot in a blocked (or used) cell moves to the nearest
 * free unused cell, so furniture never stands on the queue and no two spots are the same.
 */
export function queueSpots(grid: NavGrid, room: Room, counter: FurnitureItem, n: number): Point[] {
  const type = getFurnitureType(counter.typeId);
  const first = standPointFor(counter, type);
  const back = { x: counter.x, y: counter.y - footprintDepth(counter) / 2 };
  const len = Math.hypot(first.x - back.x, first.y - back.y) || 1;
  const dir = { x: (first.x - back.x) / len, y: (first.y - back.y) / len };
  const door = cellAt(grid, doorPoint(room));
  const reach = isCellFree(grid, door.c, door.r) ? reachableCells(grid, door.r * grid.cols + door.c) : null;
  const usable = (i: number): boolean => !grid.blocked[i] && (reach === null || reach[i] === true);
  const used = new Set<number>();
  const spots: Point[] = [];
  for (let k = 0; k < n; k++) {
    const want = { x: first.x + dir.x * QUEUE_SPACING_PX * k, y: first.y + dir.y * QUEUE_SPACING_PX * k };
    const c = cellAt(grid, want);
    const i = c.r * grid.cols + c.c;
    if (isCellFree(grid, c.c, c.r) && usable(i) && !used.has(i)) {
      used.add(i);
      spots.push(want);
      continue;
    }
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < grid.blocked.length; j++) {
      if (!usable(j) || used.has(j)) continue;
      const p = cellCenter(grid, j % grid.cols, Math.floor(j / grid.cols));
      const d = (p.x - want.x) ** 2 + (p.y - want.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best < 0) break;
    used.add(best);
    spots.push(cellCenter(grid, best % grid.cols, Math.floor(best / grid.cols)));
  }
  return spots;
}

function footprintDepth(item: FurnitureItem): number {
  const t = getFurnitureType(item.typeId);
  return item.facing === 'left' || item.facing === 'right' ? t.w : t.d;
}

/** A random customer look from CUSTOMER_LOOKS. */
export function customerLook(rng: Rng): AvatarLook {
  return {
    skin: rngPick(rng, CUSTOMER_LOOKS.skin),
    hair: rngPick(rng, CUSTOMER_LOOKS.hair),
    hairStyle: 0,
    shirt: rngPick(rng, CUSTOMER_LOOKS.shirt),
    legs: rngPick(rng, CUSTOMER_LOOKS.legs),
    shoes: rngPick(rng, CUSTOMER_LOOKS.shoes),
  };
}

/** A customer as an avatar (for drawing and walking). */
export function customerAvatar(c: Customer, roomId: number): Avatar {
  return { id: c.id, name: 'Customer', look: c.look, roomId, x: c.x, y: c.y, facing: c.facing, state: c.path.length > 0 ? 'walk' : 'idle' };
}

/** The world a customer step needs. */
export interface ShopWorld {
  room: Room;
  /** All the player's items (the shop room's are used). */
  items: readonly FurnitureItem[];
  grid: NavGrid;
  /** True while the player stands behind the counter: only then customers pay. */
  cashier: boolean;
}

function pathTo(grid: NavGrid, from: Point, to: Point): Point[] {
  const p = findPath(grid, from, to);
  return p ? p.slice(1) : [];
}

function exitPath(w: ShopWorld, from: Point): Point[] {
  return [...pathTo(w.grid, from, doorPoint(w.room)), outsidePoint(w.room)];
}

/** Where a customer stands to look at the slot's table, shelf or case. */
function shelfStand(w: ShopWorld, shelfUid: number): Point | null {
  const shelf = w.items.find((i) => i.uid === shelfUid && i.roomId === w.room.id);
  return shelf ? standPointFor(shelf, getFurnitureType(shelf.typeId)) : null;
}

/** Spawns a customer if the timer ran out. */
function spawn(state: GameState, w: ShopWorld, rng: Rng): { state: GameState; spawned: boolean } {
  const shop = state.shop;
  const want = chooseCategory(shop, rng);
  const tolerance = rollTolerance(rng);
  const look = customerLook(rng);
  const target = visit(shop, want, tolerance).slot ?? shop.slots.find((s) => s.loot !== null);
  const stand = target ? shelfStand(w, target.shelfUid) : null;
  const start = outsidePoint(w.room);
  const walkIn = stand ? findPath(w.grid, doorPoint(w.room), stand) : null;
  if (!walkIn) return { state, spawned: false };
  const c: Customer = {
    id: shop.nextCustomerId,
    look,
    x: start.x,
    y: start.y,
    facing: 'up',
    path: walkIn,
    phase: 'browse',
    want,
    tolerance,
    waitMs: 0,
    carrying: null,
    reaction: null,
    queueSpot: -1,
  };
  return { state: { ...state, shop: { ...shop, customers: [...shop.customers, c], nextCustomerId: shop.nextCustomerId - 1 } }, spawned: true };
}

/** Pays at the till: the gold goes into the wallet through the ledger, the sale is recorded. */
function pay(state: GameState, c: Customer, at: number): { state: GameState; sale: SaleRecord | null } {
  if (!c.carrying) return { state, sale: null };
  const typeId = lootTypeId(c.carrying.loot);
  const price = c.carrying.price;
  const next = applyChange(state, { reason: 'sale', gold: price, note: `sold: ${typeId}` }, at);
  if (!next) return { state, sale: null };
  return {
    state: { ...next, shop: { ...next.shop, saleHistory: recordSale(next.shop.saleHistory, typeId, price) } },
    sale: { typeId, price, at },
  };
}

/**
 * Advances the live shop by dtMs (call it in SHOP_TICK_MS steps): the customer timer (it only runs
 * while the shop has stock), walking, deciding, queueing and paying. `at` is the time at the end
 * of the step (ledger entries).
 */
export function stepShop(state: GameState, w: ShopWorld, dtMs: number, rng: Rng, at: number): { state: GameState; events: ShopEvent[] } {
  const events: ShopEvent[] = [];
  let listChanged = false;
  let s = state;

  // The customer timer.
  if (hasStock(s.shop)) {
    let left = s.shop.nextCustomerInMs - dtMs;
    if (left <= 0) {
      // A full line at the till: nobody new comes in (the timer starts again).
      const carrying = s.shop.customers.filter((c) => c.carrying !== null).length;
      const r = carrying < QUEUE_MAX ? spawn(s, w, rng) : { state: s, spawned: false };
      s = r.state;
      listChanged ||= r.spawned;
      left += customerIntervalMs(shopAppeal(w.room, w.items));
    }
    s = { ...s, shop: { ...s.shop, nextCustomerInMs: Math.max(0, left) } };
  }

  const counter = findCounter(w.items, w.room.id);
  const spotsFor = (n: number): Point[] => (counter ? queueSpots(w.grid, w.room, counter, Math.max(1, n)) : []);

  const out: Customer[] = [];
  for (const c0 of s.shop.customers) {
    let c = c0;
    // Walk.
    if (c.path.length > 0) {
      const r = walkAvatar(customerAvatar(c, w.room.id), c.path, dtMs, HOTEL_WALK_SPEED);
      c = { ...c, x: r.avatar.x, y: r.avatar.y, facing: r.avatar.facing, path: r.path };
      if (c.path.length > 0) {
        out.push(c);
        continue;
      }
      if (c.phase === 'leave') {
        listChanged = true;
        continue; // Out of the door: gone.
      }
    }
    if (c.phase === 'browse') {
      const v = visit(s.shop, c.want, c.tolerance);
      if (!v.slot?.loot || !v.decision) {
        c = { ...c, phase: 'leave', path: exitPath(w, c) };
        listChanged = true;
      } else {
        c = { ...c, phase: 'decide', waitMs: CUSTOMER_DECIDE_MS, reaction: v.decision.reaction, facing: 'up' };
        events.push({ t: 'reaction', customerId: c.id, reaction: v.decision.reaction });
        if (v.decision.buy) {
          c = { ...c, carrying: { loot: v.slot.loot, price: v.slot.price } };
          s = { ...s, shop: removeSlot(s.shop, v.slot) };
          events.push({ t: 'slots' });
        }
      }
    } else if (c.phase === 'decide') {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        listChanged = true;
        if (c.carrying && counter) {
          // Joins the end of the line (the line is numbered below).
          c = { ...c, phase: 'queue', queueSpot: Number.MAX_SAFE_INTEGER, waitMs: 0 };
        } else {
          c = { ...c, phase: 'leave', waitMs: 0, path: exitPath(w, c) };
        }
      }
    } else if (c.phase === 'queue') {
      if (c.queueSpot === 0) {
        // Waiting at the till: the client shows the coin marker until the player comes to serve.
        c = { ...c, phase: 'pay', waitMs: CUSTOMER_PAY_MS, facing: counterFacing(c, counter) };
        listChanged = true;
      }
    } else if (c.phase === 'pay') {
      // Waits at the till until the player stands behind the counter.
      if (!w.cashier) {
        out.push({ ...c, waitMs: CUSTOMER_PAY_MS });
        continue;
      }
      if (c.waitMs === CUSTOMER_PAY_MS) events.push({ t: 'paying', customerId: c.id, till: tillPoint(counter) ?? c });
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        const r = pay(s, c, at);
        s = r.state;
        if (r.sale) events.push({ t: 'sale', customerId: c.id, typeId: r.sale.typeId, price: r.sale.price, till: tillPoint(counter) ?? c });
        c = { ...c, phase: 'leave', carrying: null, queueSpot: -1, waitMs: 0, path: exitPath(w, c) };
        listChanged = true;
      }
    }
    out.push(c);
  }

  // Number the line 0, 1, 2, ... (oldest first): when the payer leaves everyone moves up one
  // spot, and a new customer goes to the end. Only customers whose spot changed get a new path.
  const line = out
    .filter((c) => c.phase === 'queue' || c.phase === 'pay')
    .sort((a, b) => a.queueSpot - b.queueSpot || b.id - a.id);
  const spots = spotsFor(line.length);
  const renumbered = new Map<number, Customer>();
  line.forEach((c, k) => {
    if (c.queueSpot === k) return;
    const to = spots[Math.min(k, spots.length - 1)] ?? c;
    renumbered.set(c.id, { ...c, queueSpot: k, path: pathTo(w.grid, c, to) });
    listChanged = true;
  });
  const customers = out.map((c) => renumbered.get(c.id) ?? c);
  s = { ...s, shop: { ...s.shop, customers } };
  if (listChanged) events.unshift({ t: 'customers', customers });
  return { state: s, events };
}

function counterFacing(c: Customer, counter: FurnitureItem | undefined): Facing {
  if (!counter) return c.facing;
  const dx = counter.x - c.x;
  const dy = counter.y - footprintDepth(counter) / 2 - c.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** The till on top of the counter (where the "+12 gold" floats up), world px. */
export function tillPoint(counter: FurnitureItem | undefined): Point | null {
  if (!counter) return null;
  const t = getFurnitureType(counter.typeId);
  // The till box sits right of the middle (furniture.json: dx 10..32 facing down), turned with the counter.
  const side = counter.facing === 'down' ? 21 : counter.facing === 'up' ? -21 : 0;
  return { x: counter.x + side, y: counter.y - t.height };
}

/** Customers that walked away from their goal get a new path (the furniture changed). */
export function repathCustomers(state: GameState, w: ShopWorld): GameState {
  const customers = state.shop.customers.map((c) => {
    const goal = c.path[c.path.length - 1];
    if (!goal) return c;
    if (c.phase === 'leave') return { ...c, path: exitPath(w, c) };
    const p = findPath(w.grid, c, goal);
    return { ...c, path: p ? p.slice(1) : [] };
  });
  return { ...state, shop: { ...state.shop, customers } };
}

/**
 * Ends every walk at once (the game was closed, or a long gap): customers carrying an item pay
 * now, everyone else is gone. Returns the sales.
 */
export function settleCustomers(state: GameState, at: number): { state: GameState; sales: SaleRecord[] } {
  let s = state;
  const sales: SaleRecord[] = [];
  for (const c of state.shop.customers) {
    const r = pay(s, c, at);
    s = r.state;
    if (r.sale) sales.push(r.sale);
  }
  return { state: { ...s, shop: { ...s.shop, customers: [] } }, sales };
}

export type { ShopState };
