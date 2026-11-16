// The tavern (step 9t): the shop room is a tavern. Pure functions on plain data; time and rng are
// passed in. The walking guests are in guests.ts, brewing in brewing.ts.
//
// - SEATS: a seat (pose 'sit') in the tavern room is a tavern seat when a table (a surface item, or
//   the bar) is next to it. Each seat has its own spot on that table: the order, the coins and the
//   empty mug lie there.
// - THE MENU: drinks and cooked food (the bag's stock) with a price each. Off the menu: switched
//   off, or none in the bag. A guest picks one thing; the price rule is the shop's (decide): too
//   expensive = they order something cheaper that they do accept, or leave with a shrug or a frown.
// - AN ORDER takes one unit out of the bag at once (ledger 'tavern_order'), so two guests never
//   order the same last mug. A guest who leaves unserved puts it back.
// - SERVING: the player taps guests (at most SERVE_QUEUE_MAX wait), picks the next order up at the
//   bar and puts it on the guest's table spot. The guest eats, leaves coins and an empty mug or
//   plate on the spot (a Mess) and goes. Coins are only ever collected by the player (ledger
//   'tavern'); a spot with coins or a dish on it takes no new guest.

import { CUSTOMER_FIRST_ID, GUEST_TABLE_NEAR_PX, FIRST_GUEST_DELAY_MS, GUEST_BASE_INTERVAL_MS, CUSTOMER_APPEAL_BASE, MENU_HISTORY_LENGTH, SERVE_QUEUE_MAX, TRAY_MAX, TABLE_SPOT_INSET_PX, TASTE_AGED_CHANCE } from './config.ts';
import type { AvatarLook } from './avatar.ts';
import type { Brew } from './brewing.ts';
import type { Cask } from './casks.ts';
import type { Cook } from './cooking.ts';
import type { TrayMug } from './tray.ts';
import { kitchenZone } from './kitchen.ts';
import { inStaffZone, staffZones } from './npcNav.ts';
import { behindPoint, footprintRect, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { getDrinkType, getMaterialType, isDrinkId, materialGroup, MATERIAL_TYPES } from './materials.ts';
import type { CustomerKind, NpcMoment } from './npcTalk.ts';
import { seatSpots } from './seats.ts';
import { mugsOnTaps, pourStop, setTap, stockFor, tapFor, tapOf, type Tap } from './taps.ts';
import { decide, validPrice } from './prices.ts';
import type { Facing, FurnitureItem, FurnitureType, MaterialId, Point, Reaction, Rect, Rng } from './types.ts';

/**
 * enter: walks in and stops just inside the door. to_seat: walks to the seat. settle: sits a moment
 * before ordering. order: waits for the order. eat: eats or drinks. no_seat: found no free seat,
 * stands a moment. no_menu: sits without an order (an empty menu, or everything too expensive).
 * leave: walks out.
 */
export type GuestPhase = 'enter' | 'to_seat' | 'settle' | 'order' | 'eat' | 'no_seat' | 'no_menu' | 'leave';

export interface GuestOrder {
  item: MaterialId;
  price: number;
  /** What they leave on the table: the price plus the drink's tip. */
  coins: number;
}

export interface Guest {
  /** Negative ids, counting down from TavernState.nextGuestId. */
  id: number;
  kind: CustomerKind;
  look: AvatarLook;
  x: number;
  y: number;
  facing: Facing;
  /** Points still to walk to (empty = standing or sitting). */
  path: Point[];
  speed: number;
  phase: GuestPhase;
  /** The id of the first guest of the group they came with. */
  groupId: number;
  /** Their seat (kept free for them from the moment they come in); null = none. */
  seat: { uid: number; index: number } | null;
  /** True once they sit on it. */
  seated: boolean;
  tolerance: number;
  /** ms left in a phase with a timer (the pause at the door, settling, eating, standing around). */
  waitMs: number;
  order: GuestOrder | null;
  /** ms they still wait for the order (counts down only while the player is in the tavern). */
  patienceMs: number;
  /** True once they called for the order. */
  warned: boolean;
  /** ms until they may say something at the table, and until the next sip or bite. */
  talkInMs: number;
  sipInMs: number;
  reaction: Reaction | null;
}

/** What a guest left on a table spot. It blocks the seat until the coins are taken and the dish is cleared. */
export interface Mess {
  id: number;
  seatUid: number;
  seatIndex: number;
  /** Where it lies (the table spot), world px. */
  x: number;
  y: number;
  coins: number;
  /** The gems a happy guest left with the coins (step S3); taken together with them. */
  gems: number;
  /** The empty mug or plate (what was served), or null. */
  dish: MaterialId | null;
}

export interface MenuEntry {
  on: boolean;
  price: number;
}

export interface TavernState {
  roomId: number;
  /** The player's choices per drink or dish; what is not in here uses defaultMenuEntry. */
  menu: Record<string, MenuEntry>;
  guests: Guest[];
  /** ms until the next guests come. */
  nextGuestInMs: number;
  /** The id of the next guest (negative, counts down; kept from the old shop counter by migration 22). */
  nextGuestId: number;
  mess: Mess[];
  nextMessId: number;
  brews: Brew[];
  /** Batches cooking on stoves (step K1, cooking.ts). */
  cooks: Cook[];
  /** Mugs ripening in casks on keg racks (step K2, casks.ts); a free slot is not stored. */
  casks: Cask[];
  /** Drinks on the taps (step T1, taps.ts): only taps that hold at least one mug. */
  taps: Tap[];
  /** Guests the player tapped: their orders wait to be carried, in this order. */
  serveQueue: number[];
  /** COD-1: the waiter's tray, up to TRAY_MAX poured mugs or dishes (one pour = one mug). A mug goes to ANY guest who waits for that item. */
  tray: TrayMug[];
  /** The last MENU_HISTORY_LENGTH prices paid per drink or dish (oldest first). */
  history: Record<string, number[]>;
  lastLines: Partial<Record<NpcMoment, number>>;
  /** The time (ms) the tavern was simulated up to. */
  updatedAt: number;
  /** False in an old save until the toast that explains the tavern was shown. */
  introSeen: boolean;
}

export function emptyTavern(roomId: number, at: number): TavernState {
  return {
    roomId,
    menu: {},
    guests: [],
    nextGuestInMs: FIRST_GUEST_DELAY_MS,
    nextGuestId: CUSTOMER_FIRST_ID,
    mess: [],
    nextMessId: 1,
    brews: [],
    cooks: [],
    casks: [],
    taps: [],
    serveQueue: [],
    tray: [],
    history: {},
    lastLines: {},
    updatedAt: at,
    introSeen: true,
  };
}

function withTavern(state: GameState, tavern: Partial<TavernState>): GameState {
  return { ...state, tavern: { ...state.tavern, ...tavern } };
}

/** ms between groups of guests: GUEST_BASE_INTERVAL_MS * 100 / (100 + appeal). */
export function guestIntervalMs(appeal: number): number {
  return (GUEST_BASE_INTERVAL_MS * CUSTOMER_APPEAL_BASE) / (CUSTOMER_APPEAL_BASE + appeal);
}

// ---------- The menu ----------

/** True for what a guest can order: a drink or a cooked dish. */
export function isServable(id: string): id is MaterialId {
  const g = materialGroup(id);
  return g === 'drink' || g === 'food';
}

/** Until the player chooses: drinks are on the menu at their value, dishes are off (they are also dungeon food). */
export function defaultMenuEntry(id: MaterialId): MenuEntry {
  return { on: materialGroup(id) === 'drink', price: getMaterialType(id).baseValue };
}

export function menuEntry(tavern: TavernState, id: MaterialId): MenuEntry {
  return tavern.menu[id] ?? defaultMenuEntry(id);
}

/** Puts a drink or dish on or off the menu and / or sets its price. Null if it is not servable or the price is not valid. */
export function setMenu(state: GameState, id: string, change: Partial<MenuEntry>): GameState | null {
  if (!isServable(id)) return null;
  const entry = { ...menuEntry(state.tavern, id), ...change };
  if (!validPrice(entry.price) || typeof entry.on !== 'boolean') return null;
  return withTavern(state, { menu: { ...state.tavern.menu, [id]: { on: entry.on, price: entry.price } } });
}

export interface MenuOffer {
  id: MaterialId;
  price: number;
  baseValue: number;
  stock: number;
}

/** What a drink or dish has in stock: a drink counts the mugs on the taps (step T1), a dish the bag. */
export function menuStock(state: GameState, id: string): number {
  return isDrinkId(id) ? mugsOnTaps(state.tavern.taps, id) : state.player.materials[id as MaterialId] ?? 0;
}

/**
 * Everything servable the player has or has put on the menu, in data order (the Menu panel's rows). A drink is a row only while it is on a
 * tap with at least one mug (step T1); its stock is the mugs on the taps. A dish is a row while it is in the bag or has a menu entry.
 */
export function menuRows(state: GameState): (MenuOffer & { on: boolean })[] {
  return MATERIAL_TYPES.filter((m) => isServable(m.id) && (isDrinkId(m.id) ? mugsOnTaps(state.tavern.taps, m.id) > 0 : (state.player.materials[m.id] ?? 0) > 0 || state.tavern.menu[m.id] !== undefined)).map((m) => {
    const e = menuEntry(state.tavern, m.id);
    return { id: m.id, price: e.price, baseValue: m.baseValue, stock: menuStock(state, m.id), on: e.on };
  });
}

/**
 * What guests can order now: on the menu and in stock. A drink counts the mugs on the taps that no open order has spoken for yet
 * (`guests` lets a step pass the orders it knows of, step T1).
 */
export function menuOffers(state: GameState, guests: readonly Guest[] = state.tavern.guests): MenuOffer[] {
  return menuRows(state)
    .map((r) => ({ ...r, stock: isDrinkId(r.id) ? stockFor(state.tavern, r.id, guests) : r.stock }))
    .filter((r) => r.on && r.stock > 0)
    .map(({ id, price, baseValue, stock }) => ({ id, price, baseValue, stock }));
}

/**
 * The taste trait (step K2): with TASTE_AGED_CHANCE a guest only looks at the aged and vintage drinks when the taps have any (the price rule then works on their
 * higher value: tolerance x valueMult). The rng is only used when there is something aged to look at, so a tavern without ripened drinks plays exactly as before.
 */
export function tasteOffers(offers: readonly MenuOffer[], rng: Rng): readonly MenuOffer[] {
  const aged = offers.filter((o) => isDrinkId(o.id) && getDrinkType(o.id).tier !== undefined);
  return aged.length > 0 && rng() < TASTE_AGED_CHANCE ? aged : offers;
}

export interface OrderChoice {
  /** What they order, or null: nothing at a price they accept. */
  order: MenuOffer | null;
  /** The face: about the order, or about the thing they wanted first when they order nothing. */
  reaction: Reaction;
  /** The thing they wanted first but found too expensive (when they took something cheaper, or nothing). */
  refused: MenuOffer | null;
}

/**
 * The menu price rule. A guest wants one thing on the menu (by rng) and takes it if price <=
 * baseValue * tolerance (big smile or smile, as in the shop). If not, they order the cheapest other
 * thing that costs less and that they do accept; if there is none they order nothing (shrug or
 * frown). Null when the menu is empty.
 */
export function chooseOrder(offers: readonly MenuOffer[], tolerance: number, rng: Rng): OrderChoice | null {
  if (offers.length === 0) return null;
  const first = offers[Math.floor(rng() * offers.length) % offers.length]!;
  const d = decide(first.price, first.baseValue, tolerance);
  if (d.buy) return { order: first, reaction: d.reaction, refused: null };
  const cheaper = offers
    .filter((o) => o.price < first.price && decide(o.price, o.baseValue, tolerance).buy)
    .sort((a, b) => a.price - b.price)[0];
  if (!cheaper) return { order: null, reaction: d.reaction, refused: first };
  return { order: cheaper, reaction: decide(cheaper.price, cheaper.baseValue, tolerance).reaction, refused: first };
}

/** The coins a guest leaves for an order: the price plus the drink's tip (rounded). */
export function coinsFor(id: MaterialId, price: number): number {
  return price + (isDrinkId(id) ? Math.round(price * getDrinkType(id).tip) : 0);
}

/** The history with one more price paid (the last MENU_HISTORY_LENGTH kept). */
export function recordOrder(history: Record<string, number[]>, id: string, price: number): Record<string, number[]> {
  return { ...history, [id]: [...(history[id] ?? []), price].slice(-MENU_HISTORY_LENGTH) };
}

// ---------- Seats ----------

/** A seat at a table. (x, y) is where the guest sits; spot is its place on the table. */
export interface TavernSeat {
  uid: number;
  index: number;
  x: number;
  y: number;
  facing: Facing;
  tableUid: number;
  spot: Point;
}

/** True for what guests sit at: a surface item (tables, a barrel, a crate) or the bar. */
export function isTable(type: FurnitureType): boolean {
  return type.surface || type.servedFromBehind === true;
}

function rectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function clampInto(v: number, lo: number, size: number): number {
  if (size < 2 * TABLE_SPOT_INSET_PX) return lo + size / 2;
  return Math.min(lo + size - TABLE_SPOT_INSET_PX, Math.max(lo + TABLE_SPOT_INSET_PX, v));
}

/** The way a guest on a seat looks: toward their table spot (the dominant axis), whatever way the stool was turned. */
function facingToward(from: Point, to: Point, fallback: Facing): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

const SEAT_CACHE = new WeakMap<readonly FurnitureItem[], Map<string, TavernSeat[]>>();

/**
 * The tavern seats of a room: every 'sit' seat (not in the staff zone behind the bar or the kitchen zone, step T1) with a table
 * at most GUEST_TABLE_NEAR_PX away; the nearest table is its table, and the spot is the point of
 * that table nearest to the seat, a little inside its edge. Cached per items list.
 */
export function tavernSeats(items: readonly FurnitureItem[], roomId: number, kitchen: Rect | null = null): TavernSeat[] {
  let perRoom = SEAT_CACHE.get(items);
  if (!perRoom) SEAT_CACHE.set(items, (perRoom = new Map()));
  // The kitchen zone grows with the room's level without the items changing: it is part of the cache key.
  const cacheKey = kitchen ? `${roomId}:${kitchen.x},${kitchen.y},${kitchen.w},${kitchen.h}` : `${roomId}`;
  const hit = perRoom.get(cacheKey);
  if (hit) return hit;
  const floor = items.filter((i) => i.roomId === roomId && i.onItemUid === null);
  const zones = kitchen ? [...staffZones(items, roomId), kitchen] : staffZones(items, roomId);
  const tables = floor.flatMap((i) => {
    const type = getFurnitureType(i.typeId);
    return isTable(type) ? [{ uid: i.uid, rect: footprintRect(i, type) }] : [];
  });
  const out: TavernSeat[] = [];
  for (const item of floor) {
    for (const s of seatSpots(item, getFurnitureType(item.typeId))) {
      if (s.pose !== 'sit' || inStaffZone(zones, s)) continue;
      let best: { uid: number; rect: Rect } | null = null;
      let bestD = GUEST_TABLE_NEAR_PX;
      for (const t of tables) {
        const d = rectDistance(s, t.rect);
        if (t.uid !== item.uid && d <= bestD) {
          bestD = d;
          best = t;
        }
      }
      if (!best) continue;
      const r = best.rect;
      const spot = { x: clampInto(s.x, r.x, r.w), y: clampInto(s.y, r.y, r.h) };
      out.push({ uid: item.uid, index: s.index, x: s.x, y: s.y, facing: facingToward(s, spot, s.facing), tableUid: best.uid, spot });
    }
  }
  perRoom.set(cacheKey, out);
  return out;
}

export function seatKey(s: { uid: number; index: number }): string {
  return `${s.uid}:${s.index}`;
}

/** The tavern seats nobody uses: no guest (sitting or on the way), no coins or dish on the spot, not the player's. */
export function freeTavernSeats(tavern: TavernState, seats: readonly TavernSeat[], taken: readonly { uid: number; index: number }[] = []): TavernSeat[] {
  const used = new Set<string>([
    ...taken.map(seatKey),
    ...tavern.guests.flatMap((g) => (g.seat ? [seatKey(g.seat)] : [])),
    ...tavern.mess.map((m) => seatKey({ uid: m.seatUid, index: m.seatIndex })),
  ]);
  return seats.filter((s) => !used.has(seatKey(s)));
}

/**
 * Seats for a group of n: together at one table when a table has n free seats (a random such
 * table), else spread over the fullest tables. Null when fewer than n seats are free.
 */
export function pickSeats(free: readonly TavernSeat[], n: number, rng: Rng): TavernSeat[] | null {
  if (n < 1 || free.length < n) return null;
  const byTable = new Map<number, TavernSeat[]>();
  for (const s of free) byTable.set(s.tableUid, [...(byTable.get(s.tableUid) ?? []), s]);
  const tables = [...byTable.values()];
  const fits = tables.filter((t) => t.length >= n);
  if (fits.length > 0) return fits[Math.floor(rng() * fits.length) % fits.length]!.slice(0, n);
  return tables.sort((a, b) => b.length - a.length).flat().slice(0, n);
}

// ---------- Serving (the player) ----------

/** The guests waiting for an order. */
export function openOrders(tavern: TavernState): Guest[] {
  return tavern.guests.filter((g) => g.phase === 'order' && g.order !== null);
}

/**
 * The player tapped a guest (or the order bubble): the order joins the serve queue. Null if the
 * guest has no open order, is already in the queue or in the player's hands, or SERVE_QUEUE_MAX wait.
 */
export function requestServe(state: GameState, guestId: number): GameState | null {
  const t = state.tavern;
  if (!openOrders(t).some((g) => g.id === guestId)) return null;
  if (t.serveQueue.includes(guestId) || t.serveQueue.length >= SERVE_QUEUE_MAX) return null;
  // COD-1: no more is poured than guests want it: mugs on the tray plus queued pours must stay under the guests waiting for that item.
  const item = openOrders(t).find((g) => g.id === guestId)!.order!.item;
  const wanting = openOrders(t).filter((g) => g.order!.item === item).length;
  const claimed = t.tray.filter((m) => m.item === item).length + t.serveQueue.filter((id) => openOrders(t).some((g) => g.id === id && g.order!.item === item)).length;
  if (claimed >= wanting) return null;
  return withTavern(state, { serveQueue: [...t.serveQueue, guestId] });
}

/**
 * At the bar: the player picks up the next order of the queue (orders of guests who left meanwhile
 * are skipped). Null with nothing queued, or with a full tray.
 */
export function pickUpOrder(state: GameState): { state: GameState; guestId: number; item: MaterialId } | null {
  const n = nextOrder(state);
  if (!n) return null;
  return { state: withTavern(state, { serveQueue: n.queue.slice(1), tray: [...state.tavern.tray, { item: n.item }] }), guestId: n.guestId, item: n.item };
}

/** The order the player carries next (orders of guests who left are skipped), with the cleaned queue. Null with full hands or an empty queue. */
export function nextOrder(state: GameState): { guestId: number; item: MaterialId; queue: number[] } | null {
  const t = state.tavern;
  if (t.tray.length >= TRAY_MAX) return null;
  const open = openOrders(t);
  const queue = t.serveQueue.filter((id) => open.some((g) => g.id === id));
  const guest = open.find((g) => g.id === queue[0]);
  return guest?.order ? { guestId: guest.id, item: guest.order.item, queue } : null;
}

export type PourResult =
  | { empty: false; state: GameState; guestId: number; item: MaterialId; standUid: number | null; slot: number | null }
  | { empty: true; state: GameState; guestId: number; item: MaterialId };

/**
 * At the bar (step T1): the player takes the next order. A dish is picked up as before (pickUpOrder). A DRINK is poured: one mug comes off
 * the first tap that holds it and is in the player's hands. If no tap holds it (the player unloaded it after the order) nothing is
 * poured: the guest leaves the queue but the ORDER STAYS OPEN, and the result says `empty`. Null with full hands or nothing queued.
 */
export function pourOrder(state: GameState, pick?: { standUid: number; slot: number }): PourResult | null {
  const n = nextOrder(state);
  if (!n) return null;
  if (!isDrinkId(n.item)) {
    const r = pickUpOrder(state)!;
    return { empty: false, state: r.state, guestId: r.guestId, item: r.item, standUid: null, slot: null };
  }
  const picked = pick ? tapOf(state.tavern.taps, pick.standUid, pick.slot) : undefined;
  const tap = picked && picked.drink === n.item && picked.mugs > 0 ? picked : tapFor(state.tavern.taps, n.item);
  if (!tap) return { empty: true, state: withTavern(state, { serveQueue: n.queue.slice(1) }), guestId: n.guestId, item: n.item };
  const taps = setTap(state.tavern.taps, { ...tap, mugs: tap.mugs - 1 });
  return { empty: false, state: withTavern(state, { taps, serveQueue: n.queue.slice(1), tray: [...state.tavern.tray, { item: n.item }] }), guestId: n.guestId, item: n.item, standUid: tap.standUid, slot: tap.slot };
}

/** Forgets the serve queue (the orders stay open). Mugs already on the tray stay there (tray.ts returnTray puts them back). */
export function cancelServe(state: GameState): GameState {
  return withTavern(state, { serveQueue: [] });
}

/** Where the player goes for a guest's order: behind the bar, then the guest's table spot. Null without a bar or that seat. */
export function serveStops(state: GameState, guestId: number): { bar: Point; table: Point } | null {
  const t = state.tavern;
  const guest = t.guests.find((g) => g.id === guestId);
  const bar = state.items.find((i) => i.roomId === t.roomId && getFurnitureType(i.typeId).servedFromBehind === true);
  const seat = guest?.seat ? tavernSeats(state.items, t.roomId, kitchenZone(state.rooms.find((r) => r.id === t.roomId))).find((s) => seatKey(s) === seatKey(guest.seat!)) : undefined;
  if (!bar || !seat) return null;
  // A drink is poured at its tap (step T1): the avatar stands level with the stand that holds it; else behind the middle of the bar.
  const pour = guest?.order && isDrinkId(guest.order.item) ? pourStop(state, guest.order.item) : null;
  return { bar: pour?.at ?? behindPoint(bar, getFurnitureType(bar.typeId)), table: seat.spot };
}

// ---------- Coins and dishes ----------

/** The player takes the coins (and the gems a happy guest tipped, step S3) of a table spot, in one change (ledger 'tavern'). Null if there are no coins. */
export function collectCoins(state: GameState, messId: number, at: number): { state: GameState; coins: number; gems: number } | null {
  const mess = state.tavern.mess.find((m) => m.id === messId);
  if (!mess || mess.coins <= 0) return null;
  const gems = mess.gems ?? 0;
  const paid = applyChange(state, { reason: 'tavern', gold: mess.coins, ...(gems > 0 ? { gems } : {}), note: gems > 0 ? 'coins and a gem from a table' : 'coins from a table' }, at);
  if (!paid) return null;
  const rest = paid.tavern.mess.flatMap((m) => (m.id !== messId ? [m] : m.dish ? [{ ...m, coins: 0, gems: 0 }] : []));
  return { state: withTavern(paid, { mess: rest }), coins: mess.coins, gems };
}

/** The player clears the empty mug or plate of a table spot. Null if there is none. */
export function clearDish(state: GameState, messId: number): GameState | null {
  const mess = state.tavern.mess.find((m) => m.id === messId);
  if (!mess?.dish) return null;
  return withTavern(state, { mess: state.tavern.mess.flatMap((m) => (m.id !== messId ? [m] : m.coins > 0 ? [{ ...m, dish: null }] : [])) });
}

/** For the Map badge: open orders, tables with coins, dishes to clear. */
export function tavernCounts(tavern: TavernState): { orders: number; coins: number; dishes: number } {
  return { orders: openOrders(tavern).length, coins: tavern.mess.filter((m) => m.coins > 0).length, dishes: tavern.mess.filter((m) => m.dish !== null).length };
}
