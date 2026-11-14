// Walking shop customers (step 7, shop life in step 9d, natural behaviour after 9d). Pure: time
// (dtMs, at) and rng are passed in.
//
// A visitor appears below the door, walks in calmly (CUSTOMER_WALK_SPEED, a little different per
// customer), stops just inside the door for a moment (and may say something about the shop), and
// then follows their own PLAN (customerPlan.ts): a few small behaviours picked by rng with
// weights (wander, look at a decoration, look at goods, talk with another customer, a remark, sit
// a moment). There is no fixed route.
// - A BUYER ends the plan at the table, shelf or case that holds the cheapest item of the
//   category they want, looks at it (a "..." thought bubble) and decides (the reaction face, maybe
//   with a line). If they buy, the item leaves the slot at once and they carry it to the customer
//   side of the counter.
// - A WINDOW-SHOPPER (buys = false) only does their small things and leaves: no decision, no
//   reaction face, nothing counted as a refusal.
// - Sometimes two come in together (a pair): the friend (followId) stays near the other one, and
//   they talk.
// At most CUSTOMER_MAX_IN_SHOP NPCs are in the shop, and at most QUEUE_MAX of them are buyers, so
// never more than QUEUE_MAX wait at the till (window-shoppers do not count for that).
// STAFF ONLY: customers use their own nav grid (npcGrid) where the strip behind the counter is
// blocked. They never walk or stand there; a decoration behind the counter is looked at from the
// nearest free spot on the customer side.
// Customers wait in a queue line: spot 0 is the paying spot in front of the counter, the others
// are in a row behind it (queueSpots; every spot is a different free nav cell), facing the
// counter; a waiting customer may sit on a free seat near their spot. The one on spot 0 waits
// until the player stands behind the counter (ShopWorld.cashier), calling out now and then, then
// pays (CUSTOMER_PAY_MS, the till animation): only then the gold comes in (ledger reason 'sale').
// Then they walk out through the door. A customer who refuses (or finds nothing) just leaves.
// Waiting customers never leave on their own (step 9d), and nothing is sold without the player.
// Kinds (step 9d): 'hurried' (faster, short look, few small things), 'browser' (looks at more),
// 'chatty' (talks more). Looks come from the free clothing and LOOK_COLORS, seeded by the id.

import { getFurnitureType, doorPoint, footprintRect, standPointFor } from './furniture.ts';
import { inStaffZone, npcGrid, npcPath, planKey, planVisit, reachableFrom, staffZones, type Behaviour } from './customerPlan.ts';
import {
  CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_BROWSE_MAX_MS,
  CUSTOMER_BROWSE_MIN_MS,
  CUSTOMER_CALL_AFTER_MS,
  CUSTOMER_CALL_EVERY_MS,
  CUSTOMER_DECIDE_MS,
  CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_FIRST_ID,
  CUSTOMER_KIND_WEIGHTS,
  CUSTOMER_MAX_IN_SHOP,
  CUSTOMER_OUTSIDE_PX,
  CUSTOMER_PAY_MS,
  CUSTOMER_SEAT_NEAR_PX,
  CUSTOMER_SIT_CHANCE,
  CUSTOMER_SPEED_VARIATION,
  CUSTOMER_WALK_SPEED,
  DECOR_LOOK_MAX_MS,
  DECOR_LOOK_MIN_MS,
  HURRIED_BROWSE_MAX_MS,
  HURRIED_BROWSE_MIN_MS,
  HURRIED_SPEED_BONUS,
  LOOK_COLORS,
  PAIR_CHANCE,
  PAIR_NEAR_PX,
  QUEUE_MAX,
  QUEUE_MIN_GAP_PX,
  QUEUE_SPACING_PX,
  REMARK_STAND_MS,
  REMARK_APPEAL_MIN,
  REMARK_EMPTY_SHARE,
  TALK_GAP_MS,
  TALK_LINES_MAX,
  TALK_LINES_MIN,
  TALK_NEAR_PX,
  VISIT_SIT_MAX_MS,
  VISIT_SIT_MIN_MS,
  WANDER_STAND_MAX_MS,
  WANDER_STAND_MIN_MS,
  WINDOW_SHOPPER_CHANCE,
  WINDOW_SHOPPER_WHEN_FULL_CHANCE,
} from './config.ts';
import { facingFor, walkAvatar, type Avatar, type AvatarLook } from './avatar.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { cellAt, cellCenter, isCellFree, reachableCells, type NavGrid } from './nav.ts';
import { doorY, doorZoneRect, type Room } from './room.ts';
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
import type { Facing, FurnitureItem, LootRef, Point, Rect, Reaction, Rng, SaleRecord, ShopCategory } from './types.ts';

/**
 * enter: walks in to just inside the door and stops there a moment. act: one small behaviour of
 * the plan (walking to its spot, then staying there). follow: a friend staying near the one they
 * came with. browse: a buyer walks to the goods and looks. decide: the reaction bubble. queue /
 * pay: at the counter. paid: waits a moment after paying. leave: walks out.
 */
export type CustomerPhase = 'enter' | 'act' | 'follow' | 'browse' | 'decide' | 'queue' | 'pay' | 'paid' | 'leave';

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
  /** False = a window-shopper (or a friend): looks around and leaves, never decides or buys. */
  buys: boolean;
  /** The small behaviours they do, in order (customerPlan.ts), and the one they are at. */
  plan: Behaviour[];
  step: number;
  /** What they are doing now (the planned behaviour, or what they do in its place), in phase 'act'. */
  doing: Behaviour | null;
  want: ShopCategory;
  tolerance: number;
  /** ms left standing still (the pause at the door, looking, deciding, paying, after paying). */
  waitMs: number;
  /** Walk speed, px per second (CUSTOMER_WALK_SPEED, varied per customer). */
  speed: number;
  /** The table, shelf or case they walk to and look at. */
  shelfUid: number | null;
  /** True while staying at the spot of a behaviour or at the goods (the "..." bubble at an item). */
  browsing: boolean;
  /** The decoration they look at now, or looked at last (its uid). */
  decorUid: number | null;
  /** A friend: the customer they came with and stay near (phase 'follow'). */
  followId: number | null;
  /** Talking with another customer: who, the bubbles left, whose turn, ms until the next bubble. */
  talk: { withId: number; left: number; turn: number; nextInMs: number } | null;
  /** Someone talks to them: they stay where they are this long, ms. */
  holdMs: number;
  /** What they bought and carry to the till. */
  carrying: { loot: LootRef; price: number } | null;
  reaction: Reaction | null;
  /** Queue spot (0 = paying spot) while in 'queue' or 'pay', else -1. */
  queueSpot: number;
  /** The seat they sit on (waiting in the queue, or the 'sit' behaviour); null = standing. */
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

const QUEUE_CACHE = new WeakMap<NavGrid, Map<string, Point[]>>();

/**
 * n queue spots: the paying spot on the customer side of the counter (its stand point), then a
 * row going away from the counter, QUEUE_SPACING_PX apart. Each spot is in a free nav cell that
 * can be reached from the door, at least QUEUE_MIN_GAP_PX from every other spot; a spot in a
 * blocked cell (or too close to another) moves to the nearest free cell that is far enough, so
 * furniture never stands on the queue and no two customers stand on each other. Pass the
 * customers' grid (npcGrid) so no spot is behind the counter. Cached per grid.
 */
export function queueSpots(grid: NavGrid, room: Room, counter: FurnitureItem, n: number): Point[] {
  const key = `${counter.x},${counter.y},${counter.facing},${n}`;
  let cache = QUEUE_CACHE.get(grid);
  if (!cache) QUEUE_CACHE.set(grid, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const type = getFurnitureType(counter.typeId);
  const first = standPointFor(counter, type);
  const back = { x: counter.x, y: counter.y - footprintDepth(counter) / 2 };
  const len = Math.hypot(first.x - back.x, first.y - back.y) || 1;
  const dir = { x: (first.x - back.x) / len, y: (first.y - back.y) / len };
  const door = cellAt(grid, doorPoint(room));
  const reach = isCellFree(grid, door.c, door.r) ? reachableCells(grid, door.r * grid.cols + door.c) : null;
  const usable = (i: number): boolean => !grid.blocked[i] && (reach === null || reach[i] === true);
  const spots: Point[] = [];
  const apart = (p: Point): boolean => spots.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= QUEUE_MIN_GAP_PX);
  for (let k = 0; k < n; k++) {
    const want = { x: first.x + dir.x * QUEUE_SPACING_PX * k, y: first.y + dir.y * QUEUE_SPACING_PX * k };
    const c = cellAt(grid, want);
    if (isCellFree(grid, c.c, c.r) && usable(c.r * grid.cols + c.c) && apart(want)) {
      spots.push(want);
      continue;
    }
    let best: Point | null = null;
    let bestD = Infinity;
    for (let j = 0; j < grid.blocked.length; j++) {
      if (!usable(j)) continue;
      const p = cellCenter(grid, j % grid.cols, Math.floor(j / grid.cols));
      const d = (p.x - want.x) ** 2 + (p.y - want.y) ** 2;
      if (d < bestD && apart(p)) {
        bestD = d;
        best = p;
      }
    }
    if (!best) break;
    spots.push(best);
  }
  cache.set(key, spots);
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

/** What one step works with: the world, the staff zones and the customers' own grid. */
interface Ctx {
  w: ShopWorld;
  zones: Rect[];
  /** The room's grid with the staff zone blocked: every customer path and spot uses this. */
  g: NavGrid;
}

function ctxOf(w: ShopWorld): Ctx {
  const zones = staffZones(w.items, w.room.id);
  return { w, zones, g: npcGrid(w.grid, zones) };
}

function exitPath(cx: Ctx, from: Point): Point[] {
  return [...npcPath(cx.g, from, doorPoint(cx.w.room)), outsidePoint(cx.w.room)];
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

/** The tables, shelves and cases with stock (their uids, each once), other than `not`. */
function stockedShelves(shop: ShopState, w: ShopWorld, not: number | null): number[] {
  const uids = new Set<number>();
  for (const slot of shop.slots) if (slot.loot && slot.shelfUid !== not && shelfStand(w, slot.shelfUid)) uids.add(slot.shelfUid);
  return [...uids];
}

/** The decorations in the shop: placed items with appeal that hold no goods (plants, rugs, banners, lamps). */
export function shopDecorations(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => {
    if (i.roomId !== roomId) return false;
    const t = getFurnitureType(i.typeId);
    return t.appeal > 0 && t.slots === 0 && !t.servedFromBehind;
  });
}

/** Walks a buyer to the goods they came for (phase 'browse'), or out when there are none. */
function goShelf(c: Customer, s: ShopState, cx: Ctx): Customer {
  const wanted = visit(s, c.want, c.tolerance).slot?.shelfUid ?? stockedShelves(s, cx.w, null)[0] ?? null;
  const stand = wanted !== null ? shelfStand(cx.w, wanted) : null;
  return stand
    ? { ...c, phase: 'browse', doing: null, browsing: false, waitMs: 0, shelfUid: wanted, path: npcPath(cx.g, c, stand) }
    : { ...c, phase: 'leave', doing: null, browsing: false, waitMs: 0, path: exitPath(cx, c) };
}

/** A new visitor of a rolled kind at `at`, with their plan. */
function newCustomer(id: number, rng: Rng, at: Point, want: ShopCategory, tolerance: number, buys: boolean, lastPlan: string | undefined): Customer {
  const kind = rollKind(rng);
  let speed = CUSTOMER_WALK_SPEED * (1 + (rng() * 2 - 1) * CUSTOMER_SPEED_VARIATION);
  if (kind === 'hurried') speed *= 1 + HURRIED_SPEED_BONUS;
  return {
    id,
    kind,
    look: customerLook(id),
    x: at.x,
    y: at.y,
    facing: 'up',
    path: [],
    phase: 'enter',
    buys,
    plan: planVisit(rng, kind, buys, lastPlan),
    step: 0,
    doing: null,
    want,
    tolerance,
    waitMs: CUSTOMER_ENTER_PAUSE_MS,
    speed,
    shelfUid: null,
    browsing: false,
    decorUid: null,
    followId: null,
    talk: null,
    holdMs: 0,
    carrying: null,
    reaction: null,
    queueSpot: -1,
    seat: null,
    sitChecked: false,
    callInMs: CUSTOMER_CALL_AFTER_MS,
  };
}

/** The buyers in the shop who have not paid yet (they are, or may still join, the line at the till). */
export function buyerCount(customers: readonly Customer[]): number {
  return customers.filter((c) => c.buys && c.phase !== 'paid' && c.phase !== 'leave').length;
}

/**
 * The timer ran out: maybe a visitor comes. A buyer only while fewer than QUEUE_MAX buyers are in
 * the shop (so the line never gets longer); else, or by chance, a window-shopper. Sometimes a
 * friend comes along. Never more than CUSTOMER_MAX_IN_SHOP NPCs in the room.
 */
function spawn(state: GameState, cx: Ctx, rng: Rng): { state: GameState; spawned: boolean } {
  const shop = state.shop;
  const w = cx.w;
  if (shop.customers.length >= CUSTOMER_MAX_IN_SHOP) return { state, spawned: false };
  const canBuy = buyerCount(shop.customers) < QUEUE_MAX;
  if (!canBuy && rng() >= WINDOW_SHOPPER_WHEN_FULL_CHANCE) return { state, spawned: false };
  // The very first visitor of a game is a buyer (the player learns the shop from them).
  const buys = canBuy && (rng() >= WINDOW_SHOPPER_CHANCE || shop.nextCustomerId === CUSTOMER_FIRST_ID);
  const want = chooseCategory(shop, rng);
  const tolerance = rollTolerance(rng);
  const target = visit(shop, want, tolerance).slot ?? shop.slots.find((s) => s.loot !== null);
  const stand = target ? shelfStand(w, target.shelfUid) : null;
  // A buyer needs a way from the door toward the goods.
  if (buys && (!stand || npcPath(cx.g, doorPoint(w.room), stand).length === 0)) return { state, spawned: false };
  const out = outsidePoint(w.room);
  let id = shop.nextCustomerId;
  let c: Customer = { ...newCustomer(id--, rng, out, want, tolerance, buys, shop.lastPlan), path: [doorPoint(w.room)], shelfUid: buys ? (target?.shelfUid ?? null) : null };
  const added: Customer[] = [];
  if (shop.customers.length + 2 <= CUSTOMER_MAX_IN_SHOP && rng() < PAIR_CHANCE) {
    // A friend comes along: a few steps behind, stays near, and they talk at least once.
    if (!c.plan.includes('talk')) {
      const spots = c.plan.map((_, i) => i);
      const withTalk = (i: number): Behaviour[] => [...c.plan.slice(0, i), 'talk', ...c.plan.slice(i)];
      const at = spots.find((i) => planKey(withTalk(i)) !== shop.lastPlan);
      // (No free place: one more small thing, so the plan still differs from the one before.)
      c = { ...c, plan: at !== undefined ? withTalk(at) : ['talk', c.plan[0] === 'wander' ? 'remark' : 'wander', ...c.plan] };
    }
    const friend = newCustomer(id--, rng, { x: out.x, y: out.y + PAIR_NEAR_PX }, want, tolerance, false, undefined);
    added.push({ ...friend, plan: [], followId: c.id, speed: c.speed, path: [doorPoint(w.room)], waitMs: CUSTOMER_ENTER_PAUSE_MS });
  }
  added.unshift(c);
  return { state: { ...state, shop: { ...shop, customers: [...shop.customers, ...added], nextCustomerId: id, lastPlan: planKey(c.plan) } }, spawned: true };
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

interface SeatRef {
  uid: number;
  index: number;
  x: number;
  y: number;
  facing: Facing;
}

/** The free seats (pose 'sit') of the shop: not used by anyone, not in the staff zone. */
function freeSeats(cx: Ctx, others: readonly Customer[]): SeatRef[] {
  const w = cx.w;
  const taken = new Set([...(w.seatsTaken ?? []), ...others.flatMap((o) => (o.seat ? [o.seat] : []))].map((t) => `${t.uid}:${t.index}`));
  const out: SeatRef[] = [];
  for (const item of w.items) {
    if (item.roomId !== w.room.id || item.onItemUid !== null) continue;
    const type = getFurnitureType(item.typeId);
    for (const spot of seatSpots(item, type)) {
      if (spot.pose !== 'sit' || taken.has(`${item.uid}:${spot.index}`) || inStaffZone(cx.zones, spot)) continue;
      out.push({ uid: item.uid, index: spot.index, x: spot.x, y: spot.y, facing: spot.facing });
    }
  }
  return out;
}

/** A free seat near a point (within CUSTOMER_SEAT_NEAR_PX), the nearest, or null. */
function freeSeatNear(cx: Ctx, at: Point, others: readonly Customer[]): SeatRef | null {
  let best: SeatRef | null = null;
  let bestD = CUSTOMER_SEAT_NEAR_PX;
  for (const seat of freeSeats(cx, others)) {
    const d = Math.hypot(seat.x - at.x, seat.y - at.y);
    if (d <= bestD) {
      bestD = d;
      best = seat;
    }
  }
  return best;
}

/** A free spot `near` px beside a point (left, right, below, above), the one nearest to `from`; null if none. */
function spotBeside(cx: Ctx, at: Point, from: Point, near: number): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const [dx, dy] of [[-near, 0], [near, 0], [0, near], [0, -near]] as const) {
    const p = { x: at.x + dx, y: at.y + dy };
    const c = cellAt(cx.g, p);
    if (!isCellFree(cx.g, c.c, c.r)) continue;
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = p;
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
  const cx = ctxOf(w);
  const g = cx.g;
  const say = (c: Customer, moment: NpcMoment, talk: TalkMoment | 'always'): string | null => {
    const r = maybeSay(s.shop.lastLines ?? {}, moment, talk === 'always' ? 1 : talkChance(talk, c.kind), rng);
    if (!r) return null;
    s = { ...s, shop: { ...s.shop, lastLines: r.lastLines } };
    return r.text;
  };
  const sayOut = (c: { id: number; kind: CustomerKind }, moment: NpcMoment, talk: TalkMoment | 'always'): void => {
    const text = say(c as Customer, moment, talk);
    if (text) events.push({ t: 'say', customerId: c.id, text });
  };
  const between = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo));

  // The customer timer.
  if (hasStock(s.shop)) {
    let left = s.shop.nextCustomerInMs - dtMs;
    if (left <= 0) {
      const r = spawn(s, cx, rng);
      s = r.state;
      listChanged ||= r.spawned;
      left += customerIntervalMs(shopAppeal(w.room, w.items));
    }
    s = { ...s, shop: { ...s.shop, nextCustomerInMs: Math.max(0, left) } };
  }

  const counter = findCounter(w.items, w.room.id);
  const spotsFor = (n: number): Point[] => (counter ? queueSpots(g, w.room, counter, Math.max(1, n)) : []);

  const out: Customer[] = [];
  const all = s.shop.customers;
  /** Changes to OTHER customers made during this step (someone starts talking to them). */
  const patches = new Map<number, Partial<Customer>>();
  let index = 0;
  /** Everyone else as they are now: the ones already stepped, then the ones still to come. */
  const others = (id: number): Customer[] => [...out, ...all.slice(index)].filter((o) => o.id !== id);
  const leave = (c: Customer): Customer => ({ ...c, phase: 'leave', doing: null, browsing: false, talk: null, seat: null, waitMs: 0, path: exitPath(cx, c) });

  // ---------- The small behaviours (phase 'act') ----------
  /** Starts one behaviour: where to go for it. Null when it cannot be done now (nothing to look at, nobody to talk to). */
  const goAct = (c: Customer, act: Behaviour): Customer | null => {
    const base: Customer = { ...c, phase: 'act', doing: act, browsing: false, waitMs: 0, seat: null, talk: null };
    if (act === 'wander') {
      const zone = doorZoneRect(w.room);
      const cells = reachableFrom(g, doorPoint(w.room)).filter((i) => {
        const p = cellCenter(g, i % g.cols, Math.floor(i / g.cols));
        return !(p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h);
      });
      if (cells.length === 0) return null;
      const i = rngPick(rng, cells);
      return { ...base, path: npcPath(g, c, cellCenter(g, i % g.cols, Math.floor(i / g.cols))) };
    }
    if (act === 'decor') {
      const decos = shopDecorations(w.items, w.room.id).filter((d) => d.uid !== c.decorUid);
      if (decos.length === 0) return null;
      const d = rngPick(rng, decos);
      // In front of it; when that spot is staff only or blocked, the nearest free spot on the customer side.
      return { ...base, decorUid: d.uid, path: npcPath(g, c, standPointFor(d, getFurnitureType(d.typeId))) };
    }
    if (act === 'goods') {
      const shelves = stockedShelves(s.shop, w, c.shelfUid);
      if (shelves.length === 0) return null;
      const uid = rngPick(rng, shelves);
      return { ...base, shelfUid: uid, path: npcPath(g, c, shelfStand(w, uid)!) };
    }
    if (act === 'talk') {
      // Someone standing around who is not busy talking: the friend first.
      const free = others(c.id).filter((o) => o.path.length === 0 && o.holdMs <= 0 && !o.talk && !o.seat && !patches.has(o.id) && (o.phase === 'follow' || (o.phase === 'act' && o.browsing && o.doing !== 'talk')));
      const friend = free.find((o) => o.followId === c.id);
      const b = friend ?? (free.length > 0 ? rngPick(rng, free) : null);
      const spot = b ? spotBeside(cx, b, c, TALK_NEAR_PX) : null;
      if (!b || !spot) return null;
      return { ...base, talk: { withId: b.id, left: 0, turn: 0, nextInMs: 0 }, path: npcPath(g, c, spot) };
    }
    if (act === 'sit') {
      const seats = freeSeats(cx, others(c.id));
      if (seats.length === 0) return null;
      const seat = rngPick(rng, seats);
      return { ...base, seat: { uid: seat.uid, index: seat.index }, path: [...npcPath(g, c, seat), { x: seat.x, y: seat.y }] };
    }
    return { ...base, path: [] }; // A remark: said right where they stand.
  };
  /** The next behaviour of the plan (or the goods a buyer came for, or out when the plan is done). */
  const startAct = (c0: Customer): Customer => {
    const c: Customer = { ...c0, seat: null, talk: null, browsing: false };
    const act = c.plan[c.step];
    if (act === undefined) {
      if (c.buys) return goShelf(c, s.shop, cx);
      sayOut(c, 'window', 'leave');
      return leave(c);
    }
    if (act === 'goods' && c.buys && c.step === c.plan.length - 1) return goShelf(c, s.shop, cx);
    // What cannot be done now becomes a remark (nobody to talk to) or a wander.
    return goAct(c, act) ?? (act === 'talk' ? goAct(c, 'remark') : null) ?? goAct(c, 'wander') ?? goAct(c, 'remark')!;
  };
  /** Arrived at the spot of a behaviour: start staying there. */
  const arriveAct = (c: Customer): Customer => {
    const stay = (ms: number, facing = c.facing): Customer => ({ ...c, browsing: true, waitMs: ms, facing });
    if (c.doing === 'decor') {
      const d = w.items.find((i) => i.uid === c.decorUid);
      return stay(between(DECOR_LOOK_MIN_MS, DECOR_LOOK_MAX_MS), d ? faceToward(c, itemMiddle(d), c.facing) : c.facing);
    }
    if (c.doing === 'goods') {
      const ms = lookMs(c);
      const shelf = w.items.find((i) => i.uid === c.shelfUid);
      events.push({ t: 'thinking', customerId: c.id, ms });
      sayOut(c, 'browse', 'browse');
      return stay(ms, shelf ? faceToward(c, itemMiddle(shelf), 'up') : 'up');
    }
    if (c.doing === 'talk' && c.talk) {
      const b = others(c.id).find((o) => o.id === c.talk!.withId);
      // Still there and close? Then they face each other and the bubbles go back and forth.
      if (b && b.path.length === 0 && !b.seat && !patches.has(b.id) && Math.hypot(b.x - c.x, b.y - c.y) <= TALK_NEAR_PX * 2.5) {
        const lines = rngInt(rng, TALK_LINES_MIN, TALK_LINES_MAX);
        const ms = lines * TALK_GAP_MS + 400;
        patches.set(b.id, { holdMs: ms, facing: faceToward(b, c, b.facing) });
        return { ...stay(ms, faceToward(c, b, c.facing)), talk: { withId: b.id, left: lines, turn: 0, nextInMs: 300 } };
      }
      sayOut(c, 'remark', 'always');
      return { ...stay(REMARK_STAND_MS), doing: 'remark', talk: null };
    }
    if (c.doing === 'remark') {
      sayOut(c, 'remark', 'always');
      return stay(REMARK_STAND_MS);
    }
    if (c.doing === 'sit') return stay(between(VISIT_SIT_MIN_MS, VISIT_SIT_MAX_MS));
    return stay(between(WANDER_STAND_MIN_MS, WANDER_STAND_MAX_MS));
  };

  for (const c0 of all) {
    index++;
    let c = c0;
    // Walk.
    if (c.path.length > 0) {
      const r = walkAvatar(customerAvatar(c, w.room.id), c.path, dtMs, c.speed ?? CUSTOMER_WALK_SPEED);
      c = { ...c, x: r.avatar.x, y: r.avatar.y, facing: r.avatar.facing, path: r.path };
      if (c.path.length > 0 && c.phase !== 'follow') {
        out.push(c);
        continue;
      }
      if (c.phase === 'leave') {
        listChanged = true;
        continue; // Out of the door: gone.
      }
      // Arrived on a seat: sit facing the way the seat faces.
      if (c.seat && c.path.length === 0) {
        const item = w.items.find((i) => i.uid === c.seat!.uid);
        if (item) c = { ...c, facing: item.facing };
        listChanged = true;
      }
    }
    // Someone is talking to them: they stay and listen.
    if (c.holdMs > 0 && (c.phase === 'act' || c.phase === 'follow')) {
      out.push({ ...c, holdMs: c.holdMs - dtMs });
      continue;
    }
    if (c.phase === 'enter') {
      // Just inside the door: a short stop (and maybe a word), then the plan.
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        if (c.followId !== null) {
          c = { ...c, phase: 'follow', waitMs: 0 };
        } else {
          const m = enterMoment(s, w);
          sayOut(c, m.moment, m.talk);
          c = startAct({ ...c, step: 0 });
        }
        listChanged = true;
      }
    } else if (c.phase === 'follow') {
      // A friend: stays near the one they came with, and leaves with them.
      const lead = others(c.id).find((o) => o.id === c.followId);
      if (!lead || lead.phase === 'leave') {
        c = leave(c);
        listChanged = true;
      } else {
        const goal = lead.path[lead.path.length - 1] ?? lead;
        const want = spotBeside(cx, goal, c, PAIR_NEAR_PX) ?? goal;
        const mine = c.path[c.path.length - 1] ?? c;
        if (Math.hypot(want.x - mine.x, want.y - mine.y) > PAIR_NEAR_PX * 0.8) {
          c = { ...c, path: npcPath(g, c, want) };
          listChanged = true;
        } else if (c.path.length === 0 && lead.path.length === 0 && c.facing !== lead.facing && !lead.talk) {
          // Standing with them: look at what they look at.
          c = { ...c, facing: lead.facing };
          listChanged = true;
        }
      }
    } else if (c.phase === 'act' && !c.browsing) {
      c = arriveAct(c);
      listChanged = true;
    } else if (c.phase === 'act' && c.waitMs - dtMs > 0) {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.talk && c.talk.left > 0) {
        // The talk: one bubble every TALK_GAP_MS, in turns.
        const next = c.talk.nextInMs - dtMs;
        if (next > 0) {
          c = { ...c, talk: { ...c.talk, nextInMs: next } };
        } else {
          const other = others(c.id).find((o) => o.id === c.talk!.withId);
          const speaker = c.talk.turn % 2 === 0 ? c : other;
          if (speaker) sayOut(speaker, c.talk.turn === 0 ? 'smalltalk' : c.talk.turn === 1 ? 'smalltalk_reply' : 'smalltalk_end', 'always');
          c = { ...c, talk: { ...c.talk, left: c.talk.left - 1, turn: c.talk.turn + 1, nextInMs: TALK_GAP_MS } };
        }
      }
    } else if (c.phase === 'act') {
      // Done here: on to the next thing (standing up first if they sat).
      c = startAct({ ...c, step: c.step + 1 });
      listChanged = true;
    } else if (c.phase === 'browse' && !c.browsing) {
      // Arrived at the goods they came for: face them and look for a while (the "..." bubble).
      const ms = lookMs(c);
      const shelf = w.items.find((i) => i.uid === c.shelfUid);
      c = { ...c, browsing: true, waitMs: ms, facing: shelf ? faceToward(c, itemMiddle(shelf), 'up') : 'up' };
      events.push({ t: 'thinking', customerId: c.id, ms });
      sayOut(c, 'browse', 'browse');
      listChanged = true;
    } else if (c.phase === 'browse' && c.waitMs - dtMs > 0) {
      c = { ...c, waitMs: c.waitMs - dtMs };
    } else if (c.phase === 'browse') {
      const v = visit(s.shop, c.want, c.tolerance);
      if (!v.slot?.loot || !v.decision) {
        c = leave(c);
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
          c = leave(c);
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
          const seat = rng() < CUSTOMER_SIT_CHANCE ? freeSeatNear(cx, c, others(c.id)) : null;
          if (seat) {
            c = { ...c, seat: { uid: seat.uid, index: seat.index }, path: [...npcPath(g, c, seat), { x: seat.x, y: seat.y }] };
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
        c = leave(c);
        listChanged = true;
      }
    }
    out.push(c);
  }

  // Someone started talking to them: they stop and turn.
  const patched = patches.size > 0 ? out.map((c) => (patches.has(c.id) ? { ...c, ...patches.get(c.id) } : c)) : out;
  if (patches.size > 0) listChanged = true;

  // Number the line 0, 1, 2, ... (oldest first): when the payer leaves everyone moves up one
  // spot, and a new customer goes to the end. Only customers whose spot changed get a new path; a
  // seated customer stays seated until it is their turn at the till.
  const line = patched
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
    renumbered.set(c.id, { ...c, queueSpot: k, seat: null, path: npcPath(g, c, to) });
  });
  const customers = patched.map((c) => renumbered.get(c.id) ?? c);
  s = { ...s, shop: { ...s.shop, customers } };
  if (listChanged) events.unshift({ t: 'customers', customers });
  return { state: s, events };
}

/** How long a customer looks at goods (the "..." bubble): short for a hurried one. */
function lookMs(c: Customer): number {
  // No rng here on purpose: the time comes from the id and how far they are, so it differs per look.
  const hurried = c.kind === 'hurried';
  const lo = hurried ? HURRIED_BROWSE_MIN_MS : CUSTOMER_BROWSE_MIN_MS;
  const hi = hurried ? HURRIED_BROWSE_MAX_MS : CUSTOMER_BROWSE_MAX_MS;
  const k = seededRng(Math.imul(Math.abs(c.id) + 1, 0x85ebca6b) ^ (c.step + 1))();
  return lo + Math.floor(k * (hi - lo));
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
  const cx = ctxOf(w);
  const counter = findCounter(w.items, w.room.id);
  const line = state.shop.customers.filter((c) => c.phase === 'queue' || c.phase === 'pay').length;
  const spots = counter ? queueSpots(cx.g, w.room, counter, Math.max(1, line)) : [];
  const customers = state.shop.customers.map((c) => {
    if (c.seat) {
      // Still on the same seat? Else stand up and go back to the queue spot.
      const item = w.items.find((i) => i.uid === c.seat!.uid && i.roomId === w.room.id);
      const spot = item ? seatSpots(item, getFurnitureType(item.typeId)).find((x) => x.index === c.seat!.index) : undefined;
      const goal = c.path[c.path.length - 1] ?? c;
      if (spot && Math.hypot(spot.x - goal.x, spot.y - goal.y) < 1) {
        return c.path.length > 0 ? { ...c, path: [...npcPath(cx.g, c, spot), { x: spot.x, y: spot.y }] } : c;
      }
      // A visitor who sat for a moment just goes on with their plan.
      if (c.phase === 'act') return { ...c, seat: null, path: [], browsing: true, waitMs: 0 };
      const to = spots[Math.min(Math.max(0, c.queueSpot), spots.length - 1)] ?? c;
      return { ...c, seat: null, path: npcPath(cx.g, c, to) };
    }
    const goal = c.path[c.path.length - 1];
    if (!goal) return c;
    if (c.phase === 'leave') return { ...c, path: exitPath(cx, c) };
    return { ...c, path: npcPath(cx.g, c, goal) };
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
  const arrived = fill.arrivals.map((a) => {
    const c = newCustomer(nextId--, rng, door, a.want, a.tolerance, true, undefined);
    return { ...c, plan: [], carrying: { loot: a.loot, price: a.price } };
  });
  const line = [...kept, ...arrived];
  const counter = findCounter(w.items, w.room.id);
  const spots = counter ? queueSpots(ctxOf(w).g, w.room, counter, Math.max(1, line.length)) : [];
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
