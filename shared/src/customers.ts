// Walking shop customers (step 7, shop life in step 9d). Pure: time (dtMs, at) and rng are passed in.
//
// Flow: a customer appears below the door, walks in calmly (CUSTOMER_WALK_SPEED, a little
// different per customer), stops just inside the door for a moment (and may say something about
// the shop), sometimes looks at a decoration first (phase 'admire', facing it), walks to the
// table, shelf or case that holds the cheapest item of the category they want, looks at it (a
// "..." thought bubble; some look at a second one), and decides (the reaction face, maybe with a
// line). At most CUSTOMER_MAX_IN_SHOP are in the shop at once. If they buy, the item leaves the
// slot at once and they carry it to the customer side of the counter.
// Customers wait in a queue line: spot 0 is the paying spot in front of the counter, the others
// are in a row behind it (queueSpots; every spot is a different free nav cell), facing the
// counter; a waiting customer may sit on a free seat near their spot. The one on spot 0 waits
// until the player stands behind the counter (ShopWorld.cashier), calling out now and then, then
// pays (CUSTOMER_PAY_MS, the till animation): only then the gold comes in (ledger reason 'sale').
// Then they walk out through the door. A customer who refuses (or finds nothing) just leaves.
// While QUEUE_MAX customers carry something to the till, no new customers come in. Waiting
// customers never leave on their own (step 9d), and nothing is sold without the player.
// Kinds (step 9d): 'hurried' (faster, short look, no decorations), 'browser' (2 to 3 things,
// decorations too), 'chatty' (talks more). Looks come from the free clothing and LOOK_COLORS,
// seeded by the customer's id.

import { getFurnitureType, doorPoint, footprintRect, standPointFor } from './furniture.ts';
import {
  BROWSER_LOOKS_MAX,
  BROWSER_LOOKS_MIN,
  CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_BROWSE_MAX_MS,
  CUSTOMER_BROWSE_MIN_MS,
  CUSTOMER_CALL_AFTER_MS,
  CUSTOMER_CALL_EVERY_MS,
  CUSTOMER_DECIDE_MS,
  CUSTOMER_DECOR_CHANCE,
  CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_KIND_WEIGHTS,
  CUSTOMER_MAX_IN_SHOP,
  CUSTOMER_OUTSIDE_PX,
  CUSTOMER_PAY_MS,
  CUSTOMER_SEAT_NEAR_PX,
  CUSTOMER_SECOND_LOOK_CHANCE,
  CUSTOMER_SIT_CHANCE,
  CUSTOMER_SPEED_VARIATION,
  CUSTOMER_WALK_SPEED,
  DECOR_LOOK_MAX_MS,
  DECOR_LOOK_MIN_MS,
  HURRIED_BROWSE_MAX_MS,
  HURRIED_BROWSE_MIN_MS,
  HURRIED_SPEED_BONUS,
  LOOK_COLORS,
  QUEUE_MAX,
  QUEUE_SPACING_PX,
  REMARK_APPEAL_MIN,
  REMARK_EMPTY_SHARE,
} from './config.ts';
import { facingFor, walkAvatar, type Avatar, type AvatarLook } from './avatar.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { cellAt, cellCenter, findPath, isCellFree, reachableCells, type NavGrid } from './nav.ts';
import { doorY, type Room } from './room.ts';
import { rngInt, rngPick, seededRng } from './rng.ts';
import { selectableClothing } from './clothing.ts';
import { seatSpots } from './seats.ts';
import { maybeSay, reactionMoment, talkChance, type CustomerKind, type NpcMoment, type TalkMoment } from './npcTalk.ts';
import {
  allSlots,
  chooseCategory,
  customerIntervalMs,
  fillQueueMath,
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

/**
 * enter: walks in to just inside the door and stops there a moment. admire: walks to a decoration
 * and looks at it. browse: walks to a table, shelf or case and looks at it. decide: the reaction
 * bubble. queue / pay: at the counter. paid: waits a moment after paying. leave: walks out.
 */
export type CustomerPhase = 'enter' | 'admire' | 'browse' | 'decide' | 'queue' | 'pay' | 'paid' | 'leave';

export interface Customer {
  /** Negative ids (players are positive). */
  id: number;
  kind: CustomerKind;
  look: AvatarLook;
  x: number;
  y: number;
  facing: Facing;
  /** Points still to walk to (empty = standing). */
  path: Point[];
  phase: CustomerPhase;
  want: ShopCategory;
  tolerance: number;
  /** ms left standing still (the pause at the door, looking, deciding, paying, after paying). */
  waitMs: number;
  /** Walk speed, px per second (CUSTOMER_WALK_SPEED, varied per customer). */
  speed: number;
  /** The table, shelf or case they walk to and look at. */
  shelfUid: number | null;
  /** True while standing at an item or a decoration, looking (the "..." bubble at an item). */
  browsing: boolean;
  /** How many tables, shelves or cases they looked at so far, and at most. */
  looks: number;
  looksMax: number;
  /** Decorations they still want to look at, and the one they look at now (its uid). */
  decorLeft: number;
  decorUid: number | null;
  /** What they bought and carry to the till. */
  carrying: { loot: LootRef; price: number } | null;
  reaction: Reaction | null;
  /** Queue spot (0 = paying spot) while in 'queue' or 'pay', else -1. */
  queueSpot: number;
  /** The seat they sit on while waiting in the queue (null = standing). */
  seat: { uid: number; index: number } | null;
  /** True once they decided whether to sit at their queue spot. */
  sitChecked: boolean;
  /** At the till without service: ms until they call out ("Hello? Anyone here?"). */
  callInMs: number;
}

export type ShopEvent =
  /** The customer list changed (someone came, left, or got a new path). */
  | { t: 'customers'; customers: Customer[] }
  /** The decision: the face, maybe a line, and the slot the item was taken from (a buy). */
  | { t: 'reaction'; customerId: number; reaction: Reaction; line?: string; took?: { shelfUid: number; index: number; loot: LootRef } }
  /** The player is behind the counter and this customer starts paying (the till animation). */
  | { t: 'paying'; customerId: number; till: Point }
  /** A customer paid at the till: the gold is in the wallet now. */
  | { t: 'sale'; customerId: number; typeId: string; price: number; till: Point }
  /** A customer stands at an item thinking ("..."), for ms. */
  | { t: 'thinking'; customerId: number; ms: number }
  /** A customer says something (a speech bubble). */
  | { t: 'say'; customerId: number; text: string }
  /** Slot contents changed (a customer took an item). */
  | { t: 'slots' };

/** The counter in the shop room (there is always exactly one). */
export function findCounter(items: readonly FurnitureItem[], roomId: number): FurnitureItem | undefined {
  return items.find((i) => i.roomId === roomId && i.typeId === 'counter');
}

/** Where customers appear and disappear: below the door, outside the floor. */
export function outsidePoint(room: Room): Point {
  const d = doorPoint(room);
  return { x: d.x, y: doorY(room) + CUSTOMER_OUTSIDE_PX };
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

/**
 * A customer's look from the free clothing and LOOK_COLORS, the same every time for the same id
 * (seeded by the id, so it survives a reload).
 */
export function customerLook(id: number): AvatarLook {
  const rng = seededRng(Math.imul(Math.abs(id) + 1, 0x9e3779b1) ^ 0x5bd1e995);
  return {
    skin: rngPick(rng, LOOK_COLORS.skin),
    hair: rngPick(rng, LOOK_COLORS.hair),
    hairStyle: rngPick(rng, selectableClothing('hair')).id,
    top: rngPick(rng, selectableClothing('top')).id,
    shirt: rngPick(rng, LOOK_COLORS.top),
    bottoms: rngPick(rng, selectableClothing('bottoms')).id,
    legs: rngPick(rng, LOOK_COLORS.bottoms),
    shoes: rngPick(rng, LOOK_COLORS.shoes),
  };
}

/** A customer kind by CUSTOMER_KIND_WEIGHTS. */
export function rollKind(rng: Rng): CustomerKind {
  const kinds = Object.keys(CUSTOMER_KIND_WEIGHTS) as CustomerKind[];
  const total = kinds.reduce((a, k) => a + CUSTOMER_KIND_WEIGHTS[k], 0);
  let r = rng() * total;
  for (const k of kinds) {
    r -= CUSTOMER_KIND_WEIGHTS[k];
    if (r < 0) return k;
  }
  return kinds[kinds.length - 1]!;
}

/** The customers waiting with an item for the till (the "n waiting" badge). */
export function waitingCount(customers: readonly Customer[]): number {
  return customers.filter((c) => c.carrying !== null).length;
}

/** A customer as an avatar (for drawing and walking). */
export function customerAvatar(c: Customer, roomId: number): Avatar {
  const state = c.path.length > 0 ? 'walk' : c.seat ? 'sit' : 'idle';
  return { id: c.id, name: 'Customer', look: c.look, roomId, x: c.x, y: c.y, facing: c.facing, state };
}

/** The world a customer step needs. */
export interface ShopWorld {
  room: Room;
  /** All the player's items (the shop room's are used). */
  items: readonly FurnitureItem[];
  grid: NavGrid;
  /** True while the player stands behind the counter: only then customers pay. */
  cashier: boolean;
  /** Seats the player's avatar uses (customers do not sit there). */
  seatsTaken?: readonly { uid: number; index: number }[];
}

function pathTo(grid: NavGrid, from: Point, to: Point): Point[] {
  const p = findPath(grid, from, to);
  return p ? p.slice(1) : [];
}

function exitPath(w: ShopWorld, from: Point): Point[] {
  return [...pathTo(w.grid, from, doorPoint(w.room)), outsidePoint(w.room)];
}

/** The middle of an item's footprint. */
function itemMiddle(item: FurnitureItem): Point {
  const r = footprintRect(item, getFurnitureType(item.typeId));
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Facing from a point toward another (the dominant axis). */
function faceToward(from: Point, to: Point, current: Facing): Facing {
  return facingFor(to.x - from.x, to.y - from.y, current);
}

/** Where a customer stands to look at the slot's table, shelf or case. */
function shelfStand(w: ShopWorld, shelfUid: number): Point | null {
  const shelf = w.items.find((i) => i.uid === shelfUid && i.roomId === w.room.id);
  return shelf ? standPointFor(shelf, getFurnitureType(shelf.typeId)) : null;
}

/** The stand point of a table, shelf or case with stock other than `not` (the first one), or null. */
function anyStand(shop: ShopState, w: ShopWorld, not: number | null): { uid: number; stand: Point } | null {
  for (const slot of shop.slots) {
    if (!slot.loot || slot.shelfUid === not) continue;
    const stand = shelfStand(w, slot.shelfUid);
    if (stand) return { uid: slot.shelfUid, stand };
  }
  return null;
}

/** The decorations in the shop: placed items with appeal that hold no goods (plants, rugs, banners, lamps). */
export function shopDecorations(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => {
    if (i.roomId !== roomId) return false;
    const t = getFurnitureType(i.typeId);
    return t.appeal > 0 && t.slots === 0 && !t.servedFromBehind;
  });
}

/** Walks a customer to a decoration they have not looked at (phase 'admire'), or null. */
function goAdmire(c: Customer, w: ShopWorld, rng: Rng): Customer | null {
  const decos = shopDecorations(w.items, w.room.id).filter((d) => d.uid !== c.decorUid);
  if (decos.length === 0) return null;
  const d = rngPick(rng, decos);
  const path = findPath(w.grid, c, standPointFor(d, getFurnitureType(d.typeId)));
  if (!path) return null;
  return { ...c, phase: 'admire', browsing: false, waitMs: 0, decorUid: d.uid, path: path.slice(1) };
}

/** Walks a customer to their table, shelf or case (phase 'browse'), or out when there is none. */
function goShelf(c: Customer, s: ShopState, w: ShopWorld): Customer {
  const own = c.shelfUid !== null ? shelfStand(w, c.shelfUid) : null;
  const target = own && c.shelfUid !== null && s.slots.some((x) => x.shelfUid === c.shelfUid && x.loot) ? { uid: c.shelfUid, stand: own } : anyStand(s, w, null);
  const path = target ? findPath(w.grid, c, target.stand) : null;
  return path && target
    ? { ...c, phase: 'browse', browsing: false, waitMs: 0, shelfUid: target.uid, path: path.slice(1) }
    : { ...c, phase: 'leave', browsing: false, waitMs: 0, path: exitPath(w, c) };
}

/** A new customer of a rolled kind at `at` (the plan: speed, how many things they look at). */
function newCustomer(id: number, rng: Rng, at: Point, want: ShopCategory, tolerance: number, hasDecor: boolean): Customer {
  const kind = rollKind(rng);
  let speed = CUSTOMER_WALK_SPEED * (1 + (rng() * 2 - 1) * CUSTOMER_SPEED_VARIATION);
  let looksMax = 1;
  let decorLeft = 0;
  if (kind === 'hurried') {
    speed *= 1 + HURRIED_SPEED_BONUS;
  } else if (kind === 'browser') {
    const things = rngInt(rng, BROWSER_LOOKS_MIN, BROWSER_LOOKS_MAX);
    decorLeft = hasDecor ? 1 : 0;
    looksMax = Math.max(1, things - decorLeft);
  } else {
    decorLeft = hasDecor && rng() < CUSTOMER_DECOR_CHANCE ? 1 : 0;
    looksMax = rng() < CUSTOMER_SECOND_LOOK_CHANCE ? 2 : 1;
  }
  return {
    id,
    kind,
    look: customerLook(id),
    x: at.x,
    y: at.y,
    facing: 'up',
    path: [],
    phase: 'enter',
    want,
    tolerance,
    waitMs: CUSTOMER_ENTER_PAUSE_MS,
    speed,
    shelfUid: null,
    browsing: false,
    looks: 0,
    looksMax,
    decorLeft,
    decorUid: null,
    carrying: null,
    reaction: null,
    queueSpot: -1,
    seat: null,
    sitChecked: false,
    callInMs: CUSTOMER_CALL_AFTER_MS,
  };
}

/** Spawns a customer if the timer ran out. */
function spawn(state: GameState, w: ShopWorld, rng: Rng): { state: GameState; spawned: boolean } {
  const shop = state.shop;
  const want = chooseCategory(shop, rng);
  const tolerance = rollTolerance(rng);
  const target = visit(shop, want, tolerance).slot ?? shop.slots.find((s) => s.loot !== null);
  const stand = target ? shelfStand(w, target.shelfUid) : null;
  // They come in through the door and stop just inside it first (phase 'enter').
  if (!stand || !findPath(w.grid, doorPoint(w.room), stand)) return { state, spawned: false };
  const hasDecor = shopDecorations(w.items, w.room.id).length > 0;
  const c: Customer = {
    ...newCustomer(shop.nextCustomerId, rng, outsidePoint(w.room), want, tolerance, hasDecor),
    path: [doorPoint(w.room)],
    shelfUid: target?.shelfUid ?? null,
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

/** What a customer says on the way in: a remark about the shop (lovely / empty) or a greeting. */
function enterMoment(s: GameState, w: ShopWorld): { moment: NpcMoment; talk: TalkMoment } {
  const total = allSlots(w.items, w.room.id).length;
  const filled = s.shop.slots.filter((x) => x.loot).length;
  if (total > 0 && filled / total <= REMARK_EMPTY_SHARE) return { moment: 'empty', talk: 'remark' };
  if (shopAppeal(w.room, w.items) >= REMARK_APPEAL_MIN) return { moment: 'lovely', talk: 'remark' };
  return { moment: 'enter', talk: 'enter' };
}

/** A free seat (pose 'sit') near a point, not used by anyone, or null. */
function freeSeatNear(w: ShopWorld, at: Point, others: readonly Customer[]): { uid: number; index: number; x: number; y: number; facing: Facing } | null {
  const taken = new Set([...(w.seatsTaken ?? []), ...others.flatMap((o) => (o.seat ? [o.seat] : []))].map((t) => `${t.uid}:${t.index}`));
  let best: { uid: number; index: number; x: number; y: number; facing: Facing } | null = null;
  let bestD = CUSTOMER_SEAT_NEAR_PX;
  for (const item of w.items) {
    if (item.roomId !== w.room.id || item.onItemUid !== null) continue;
    const type = getFurnitureType(item.typeId);
    for (const spot of seatSpots(item, type)) {
      if (spot.pose !== 'sit' || taken.has(`${item.uid}:${spot.index}`)) continue;
      const d = Math.hypot(spot.x - at.x, spot.y - at.y);
      if (d <= bestD) {
        bestD = d;
        best = { uid: item.uid, index: spot.index, x: spot.x, y: spot.y, facing: spot.facing };
      }
    }
  }
  return best;
}

/**
 * Advances the live shop by dtMs (call it in SHOP_TICK_MS steps): the customer timer (it only runs
 * while the shop has stock), walking, looking, deciding, queueing, talking and paying. `at` is the
 * time at the end of the step (ledger entries).
 */
export function stepShop(state: GameState, w: ShopWorld, dtMs: number, rng: Rng, at: number): { state: GameState; events: ShopEvent[] } {
  const events: ShopEvent[] = [];
  let listChanged = false;
  let s = state;
  const say = (c: Customer, moment: NpcMoment, talk: TalkMoment): string | null => {
    const r = maybeSay(s.shop.lastLines ?? {}, moment, talkChance(talk, c.kind), rng);
    if (!r) return null;
    s = { ...s, shop: { ...s.shop, lastLines: r.lastLines } };
    return r.text;
  };
  const sayOut = (c: Customer, moment: NpcMoment, talk: TalkMoment): void => {
    const text = say(c, moment, talk);
    if (text) events.push({ t: 'say', customerId: c.id, text });
  };

  // The customer timer.
  if (hasStock(s.shop)) {
    let left = s.shop.nextCustomerInMs - dtMs;
    if (left <= 0) {
      // A full shop or a full line at the till: nobody new comes in (the timer starts again).
      const room = s.shop.customers.length < CUSTOMER_MAX_IN_SHOP && waitingCount(s.shop.customers) < QUEUE_MAX;
      const r = room ? spawn(s, w, rng) : { state: s, spawned: false };
      s = r.state;
      listChanged ||= r.spawned;
      left += customerIntervalMs(shopAppeal(w.room, w.items));
    }
    s = { ...s, shop: { ...s.shop, nextCustomerInMs: Math.max(0, left) } };
  }

  const counter = findCounter(w.items, w.room.id);
  const spotsFor = (n: number): Point[] => (counter ? queueSpots(w.grid, w.room, counter, Math.max(1, n)) : []);

  const out: Customer[] = [];
  const all = s.shop.customers;
  for (const c0 of all) {
    let c = c0;
    // Walk.
    if (c.path.length > 0) {
      const r = walkAvatar(customerAvatar(c, w.room.id), c.path, dtMs, c.speed ?? CUSTOMER_WALK_SPEED);
      c = { ...c, x: r.avatar.x, y: r.avatar.y, facing: r.avatar.facing, path: r.path };
      if (c.path.length > 0) {
        out.push(c);
        continue;
      }
      if (c.phase === 'leave') {
        listChanged = true;
        continue; // Out of the door: gone.
      }
      // Arrived on a seat: sit facing the way the seat faces.
      if (c.seat) {
        const item = w.items.find((i) => i.uid === c.seat!.uid);
        if (item) c = { ...c, facing: item.facing };
        listChanged = true;
      }
    }
    if (c.phase === 'enter') {
      // Just inside the door: a short stop (and maybe a word), then a decoration or the goods.
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        const m = enterMoment(s, w);
        sayOut(c, m.moment, m.talk);
        c = (c.decorLeft > 0 ? goAdmire(c, w, rng) : null) ?? goShelf(c, s.shop, w);
        listChanged = true;
      }
    } else if (c.phase === 'admire' && !c.browsing) {
      // At the decoration: face it and look a while.
      const d = w.items.find((i) => i.uid === c.decorUid);
      const ms = DECOR_LOOK_MIN_MS + Math.floor(rng() * (DECOR_LOOK_MAX_MS - DECOR_LOOK_MIN_MS));
      c = { ...c, browsing: true, waitMs: ms, facing: d ? faceToward(c, itemMiddle(d), c.facing) : c.facing };
      listChanged = true;
    } else if (c.phase === 'admire' && c.waitMs - dtMs > 0) {
      c = { ...c, waitMs: c.waitMs - dtMs };
    } else if (c.phase === 'admire') {
      const left = c.decorLeft - 1;
      c = { ...c, decorLeft: left, browsing: false };
      c = (left > 0 ? goAdmire(c, w, rng) : null) ?? goShelf(c, s.shop, w);
      listChanged = true;
    } else if (c.phase === 'browse' && !c.browsing) {
      // Arrived at the item: face it and look for a while (the "..." bubble).
      const hurried = c.kind === 'hurried';
      const lo = hurried ? HURRIED_BROWSE_MIN_MS : CUSTOMER_BROWSE_MIN_MS;
      const hi = hurried ? HURRIED_BROWSE_MAX_MS : CUSTOMER_BROWSE_MAX_MS;
      const ms = lo + Math.floor(rng() * (hi - lo));
      const shelf = w.items.find((i) => i.uid === c.shelfUid);
      c = { ...c, browsing: true, waitMs: ms, looks: (c.looks ?? 0) + 1, facing: shelf ? faceToward(c, itemMiddle(shelf), 'up') : 'up' };
      events.push({ t: 'thinking', customerId: c.id, ms });
      sayOut(c, 'browse', 'browse');
      listChanged = true;
    } else if (c.phase === 'browse' && c.waitMs - dtMs > 0) {
      c = { ...c, waitMs: c.waitMs - dtMs };
    } else if (c.phase === 'browse' && (c.looks ?? 1) < (c.looksMax ?? 1) && anyStand(s.shop, w, c.shelfUid)) {
      // Some look at a second (or third) table, shelf or case first.
      const other = anyStand(s.shop, w, c.shelfUid)!;
      const path = findPath(w.grid, c, other.stand);
      c = { ...c, browsing: false, waitMs: 0, shelfUid: other.uid, path: path ? path.slice(1) : [] };
      listChanged = true;
    } else if (c.phase === 'browse') {
      const v = visit(s.shop, c.want, c.tolerance);
      if (!v.slot?.loot || !v.decision) {
        c = { ...c, phase: 'leave', browsing: false, path: exitPath(w, c) };
        listChanged = true;
      } else {
        c = { ...c, phase: 'decide', browsing: false, waitMs: CUSTOMER_DECIDE_MS, reaction: v.decision.reaction };
        const line = say(c, reactionMoment(v.decision.reaction), 'reaction');
        const took = v.decision.buy ? { shelfUid: v.slot.shelfUid, index: v.slot.index, loot: v.slot.loot } : undefined;
        events.push({ t: 'reaction', customerId: c.id, reaction: v.decision.reaction, ...(line ? { line } : {}), ...(took ? { took } : {}) });
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
      if (c.queueSpot === 0 && !c.seat) {
        // Waiting at the till: the client shows the coin marker until the player comes to serve.
        c = { ...c, phase: 'pay', waitMs: CUSTOMER_PAY_MS, callInMs: CUSTOMER_CALL_AFTER_MS, facing: counterFacing(c, counter) };
        listChanged = true;
      } else if (c.queueSpot > 0 && c.queueSpot !== Number.MAX_SAFE_INTEGER && !c.seat) {
        // In the line: face the counter; maybe sit on a free seat close by.
        const facing = counterFacing(c, counter);
        if (facing !== c.facing) {
          c = { ...c, facing };
          listChanged = true;
        }
        if (!c.sitChecked) {
          c = { ...c, sitChecked: true };
          const seat = rng() < CUSTOMER_SIT_CHANCE ? freeSeatNear(w, c, [...out, ...all.filter((o) => o.id !== c.id)]) : null;
          if (seat) {
            c = { ...c, seat: { uid: seat.uid, index: seat.index }, path: [...pathTo(w.grid, c, seat), { x: seat.x, y: seat.y }] };
            listChanged = true;
          }
        }
      }
    } else if (c.phase === 'pay') {
      // Waits at the till until the player stands behind the counter (never leaves on their own).
      if (!w.cashier) {
        let callIn = (c.callInMs ?? CUSTOMER_CALL_AFTER_MS) - dtMs;
        if (callIn <= 0) {
          sayOut(c, 'queue', 'queue');
          callIn = CUSTOMER_CALL_EVERY_MS;
        }
        out.push({ ...c, waitMs: CUSTOMER_PAY_MS, callInMs: callIn });
        continue;
      }
      if (c.waitMs === CUSTOMER_PAY_MS) {
        events.push({ t: 'paying', customerId: c.id, till: tillPoint(counter) ?? c });
        sayOut(c, 'pay', 'pay');
      }
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        const r = pay(s, c, at);
        s = r.state;
        if (r.sale) events.push({ t: 'sale', customerId: c.id, typeId: r.sale.typeId, price: r.sale.price, till: tillPoint(counter) ?? c });
        // A moment at the till after paying, then out (the client keeps the item in their hands;
        // `carrying` is only what still waits for the till).
        c = { ...c, phase: 'paid', carrying: null, queueSpot: -1, waitMs: CUSTOMER_AFTER_PAY_MS };
        listChanged = true;
      }
    } else if (c.phase === 'paid') {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        sayOut(c, 'leave', 'leave');
        c = { ...c, phase: 'leave', waitMs: 0, path: exitPath(w, c) };
        listChanged = true;
      }
    }
    out.push(c);
  }

  // Number the line 0, 1, 2, ... (oldest first): when the payer leaves everyone moves up one
  // spot, and a new customer goes to the end. Only customers whose spot changed get a new path; a
  // seated customer stays seated until it is their turn at the till.
  const line = out
    .filter((c) => c.phase === 'queue' || c.phase === 'pay')
    .sort((a, b) => a.queueSpot - b.queueSpot || b.id - a.id);
  const spots = spotsFor(line.length);
  const renumbered = new Map<number, Customer>();
  line.forEach((c, k) => {
    if (c.queueSpot === k) return;
    listChanged = true;
    if (c.seat && k > 0) {
      renumbered.set(c.id, { ...c, queueSpot: k });
      return;
    }
    const to = spots[Math.min(k, spots.length - 1)] ?? c;
    renumbered.set(c.id, { ...c, queueSpot: k, seat: null, path: pathTo(w.grid, c, to) });
  });
  const customers = out.map((c) => renumbered.get(c.id) ?? c);
  s = { ...s, shop: { ...s.shop, customers } };
  if (listChanged) events.unshift({ t: 'customers', customers });
  return { state: s, events };
}

function counterFacing(c: Point & { facing: Facing }, counter: FurnitureItem | undefined): Facing {
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
  const counter = findCounter(w.items, w.room.id);
  const line = state.shop.customers.filter((c) => c.phase === 'queue' || c.phase === 'pay').length;
  const spots = counter ? queueSpots(w.grid, w.room, counter, Math.max(1, line)) : [];
  const customers = state.shop.customers.map((c) => {
    if (c.seat) {
      // Still on the same seat? Else stand up and go back to the queue spot.
      const item = w.items.find((i) => i.uid === c.seat!.uid && i.roomId === w.room.id);
      const spot = item ? seatSpots(item, getFurnitureType(item.typeId)).find((x) => x.index === c.seat!.index) : undefined;
      const goal = c.path[c.path.length - 1] ?? c;
      if (spot && Math.hypot(spot.x - goal.x, spot.y - goal.y) < 1) {
        return c.path.length > 0 ? { ...c, path: [...pathTo(w.grid, c, spot), { x: spot.x, y: spot.y }] } : c;
      }
      const to = spots[Math.min(Math.max(0, c.queueSpot), spots.length - 1)] ?? c;
      return { ...c, seat: null, path: pathTo(w.grid, c, to) };
    }
    const goal = c.path[c.path.length - 1];
    if (!goal) return c;
    if (c.phase === 'leave') return { ...c, path: exitPath(w, c) };
    const p = findPath(w.grid, c, goal);
    return { ...c, path: p ? p.slice(1) : [] };
  });
  return { ...state, shop: { ...state.shop, customers } };
}

/**
 * The catch-up after a break (the game was closed, or a long gap; step 9d). Nothing is sold and no
 * gold comes in. Customers carrying an item stay in the line; everyone else is gone. Then the
 * customers who would have come meanwhile (fillQueueMath: maths only) take their item and join the
 * line, at most QUEUE_MAX in all. Everyone in the line stands at their queue spot (no walking),
 * facing the counter. Returns how many new customers came.
 */
export function catchUpShop(state: GameState, w: ShopWorld, at: number, rng: Rng): { state: GameState; arrived: number } {
  const kept = state.shop.customers.filter((c) => c.carrying !== null).sort((a, b) => a.queueSpot - b.queueSpot || b.id - a.id);
  const gap = Math.max(0, at - state.shop.updatedAt);
  const fill = fillQueueMath({ ...state.shop, customers: kept }, shopAppeal(w.room, w.items), kept.length, gap, rng);
  let nextId = fill.shop.nextCustomerId;
  const door = doorPoint(w.room);
  const hasDecor = shopDecorations(w.items, w.room.id).length > 0;
  const arrived = fill.arrivals.map((a) => {
    const c = newCustomer(nextId--, rng, door, a.want, a.tolerance, hasDecor);
    return { ...c, carrying: { loot: a.loot, price: a.price } };
  });
  const line = [...kept, ...arrived];
  const counter = findCounter(w.items, w.room.id);
  const spots = counter ? queueSpots(w.grid, w.room, counter, Math.max(1, line.length)) : [];
  const placed = line.map((c, k): Customer => {
    const spot = spots[Math.min(k, spots.length - 1)] ?? door;
    const base = { ...c, x: spot.x, y: spot.y, path: [], browsing: false, seat: null, sitChecked: false, queueSpot: k, callInMs: CUSTOMER_CALL_AFTER_MS };
    return { ...base, phase: k === 0 ? 'pay' : 'queue', waitMs: k === 0 ? CUSTOMER_PAY_MS : 0, facing: counterFacing(base, counter) };
  });
  return {
    state: { ...state, shop: { ...fill.shop, customers: placed, nextCustomerId: nextId, updatedAt: at } },
    arrived: arrived.length,
  };
}

export type { ShopState };
