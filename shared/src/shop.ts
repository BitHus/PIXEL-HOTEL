// The shop (brief section 9, step 7). Pure functions on plain data; time and rng are passed in.
//
// - Slots come from the tables, shelves and cases placed in the shop room (FurnitureType.slots).
//   GameState.shop.slots holds only the filled slots: { shelfUid, index, loot, price }.
// - Putting loot on a slot takes it out of the bag (ledger reason 'shelf'); taking it back puts
//   it back. A furniture item on a slot is removed from GameState.items (its uid is kept in the
//   slot) and comes back with the same uid. A slot holds one unit (one material or one item).
// - Customers: one every CUSTOMER_BASE_INTERVAL_MS * 100 / (100 + appeal) while the shop has
//   stock (the timer pauses while it is empty). Each wants one category, has a tolerance, looks
//   at the cheapest item in that category and buys it if price <= baseValue * tolerance.
// - The walking customers live in customers.ts. Nothing is ever sold without the player at the
//   till (step 9d). After a break (closed game, long gap) fillQueueMath does the maths only: the
//   customers who would have come take their item and wait in the queue (at most QUEUE_MAX).

import {
  APPEAL_MAX_PER_TYPE,
  CUSTOMER_APPEAL_BASE,
  CUSTOMER_BASE_INTERVAL_MS,
  CUSTOMER_FIRST_ID,
  CUSTOMER_STOCKED_CATEGORY_CHANCE,
  CUSTOMER_TOLERANCE_MAX,
  CUSTOMER_TOLERANCE_MIN,
  FIRST_CUSTOMER_DELAY_MS,
  OFFLINE_MAX_MS,
  QUEUE_MAX,
  REACTION_BIG_SMILE_MAX,
  REACTION_SHRUG_MAX,
  SALE_HISTORY_LENGTH,
  SHOP_APPEAL_MAX,
  SHOP_PRICE_MAX,
} from './config.ts';
import type { Customer } from './customers.ts';
import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { nextInventoryUid } from './inventory.ts';
import { applyChange, type Change } from './ledger.ts';
import { getMaterialType, isMaterialId } from './materials.ts';
import type { Room } from './room.ts';
import { styleAppeal } from './styles.ts';
import type { NpcMoment } from './npcTalk.ts';
import type { FurnitureItem, LootRef, MaterialId, Reaction, Rng, ShopCategory, ShopSlot } from './types.ts';

/** 'food' (step 9b): crops and cooked food. Seeds count as materials. */
export const SHOP_CATEGORIES: readonly ShopCategory[] = ['materials', 'home_furniture', 'shop_furniture', 'crypt_furniture', 'food'];

export interface ShopState {
  roomId: number;
  /** Filled slots only (empty slots are not stored). */
  slots: ShopSlot[];
  /** ms until the next customer. Counts down only while the shop has stock. */
  nextCustomerInMs: number;
  /** The last SALE_HISTORY_LENGTH sale prices per item type (oldest first). */
  saleHistory: Record<string, number[]>;
  /** Customers walking in the shop right now (customers.ts). */
  customers: Customer[];
  nextCustomerId: number;
  /** The time (ms) the shop was simulated up to. */
  updatedAt: number;
  /** The index of the last line said per talk moment (step 9d: never the same line twice in a row). */
  lastLines: Partial<Record<NpcMoment, number>>;
  /** The plan of the visitor who came in last (customerPlan.ts planKey): the next one gets another. */
  lastPlan?: string;
}

export interface ShelfSlotRef {
  shelfUid: number;
  index: number;
}

/** What the player puts on a slot: a material, or a furniture type (the oldest one in the bag). */
export type StockPick = { kind: 'material'; id: MaterialId } | { kind: 'furniture'; typeId: string };

/** A new shop: no stock, the first customer 10 s after it gets stock. */
export function emptyShop(roomId: number, at: number): ShopState {
  return {
    roomId,
    slots: [],
    nextCustomerInMs: FIRST_CUSTOMER_DELAY_MS,
    saleHistory: {},
    customers: [],
    nextCustomerId: CUSTOMER_FIRST_ID,
    updatedAt: at,
    lastLines: {},
  };
}

// ---------- Slots ----------

/** The placed items in the room that hold goods (tables, shelves, cases), in uid order. */
export function slotItems(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && getFurnitureType(i.typeId).slots > 0).sort((a, b) => a.uid - b.uid);
}

/** Every slot of every table, shelf and case in the room. */
export function allSlots(items: readonly FurnitureItem[], roomId: number): ShelfSlotRef[] {
  return slotItems(items, roomId).flatMap((i) =>
    Array.from({ length: getFurnitureType(i.typeId).slots }, (_, index) => ({ shelfUid: i.uid, index })),
  );
}

export function slotAt(shop: ShopState, ref: ShelfSlotRef): ShopSlot | undefined {
  return shop.slots.find((s) => s.shelfUid === ref.shelfUid && s.index === ref.index);
}

/** The material id or furniture type id of a loot. */
export function lootTypeId(loot: LootRef): string {
  return loot.kind === 'material' ? loot.id : loot.typeId;
}

export function lootCategory(loot: LootRef): ShopCategory {
  if (loot.kind === 'furniture') return getFurnitureType(loot.typeId).category as ShopCategory;
  const group = getMaterialType(loot.id).group;
  return group === 'crop' || group === 'food' ? 'food' : 'materials';
}

export function lootBaseValue(loot: LootRef): number {
  return loot.kind === 'material' ? getMaterialType(loot.id).baseValue : getFurnitureType(loot.typeId).baseValue;
}

/** The name of a material or furniture type id. */
export function typeName(typeId: string): string {
  return isMaterialId(typeId) ? getMaterialType(typeId).name : getFurnitureType(typeId).name;
}

/** The base value of a material or furniture type id. */
export function typeBaseValue(typeId: string): number {
  return isMaterialId(typeId) ? getMaterialType(typeId).baseValue : getFurnitureType(typeId).baseValue;
}

/** A price is whole gold from 1 to SHOP_PRICE_MAX. */
export function validPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 1 && price <= SHOP_PRICE_MAX;
}

function isSlotOf(state: GameState, ref: ShelfSlotRef): boolean {
  const shelf = state.items.find((i) => i.uid === ref.shelfUid && i.roomId === state.shop.roomId);
  return !!shelf && Number.isInteger(ref.index) && ref.index >= 0 && ref.index < getFurnitureType(shelf.typeId).slots;
}

function withShop(state: GameState, shop: Partial<ShopState>): GameState {
  return { ...state, shop: { ...state.shop, ...shop } };
}

/**
 * Puts one unit from the bag on an empty slot with a price. A furniture pick takes the oldest
 * item of that type in the bag. Null if the slot is not free, the price is not valid or the bag
 * has none.
 */
export function putOnShelf(state: GameState, ref: ShelfSlotRef, pick: StockPick, price: number, at: number): GameState | null {
  if (!isSlotOf(state, ref) || slotAt(state.shop, ref) || !validPrice(price)) return null;
  let loot: LootRef;
  let change: Change;
  if (pick.kind === 'material') {
    if (!isMaterialId(pick.id)) return null;
    loot = { kind: 'material', id: pick.id, qty: 1 };
    change = { reason: 'shelf', materials: { [pick.id]: -1 }, note: `on sale: ${pick.id}` };
  } else {
    const uid = nextInventoryUid(state.items, pick.typeId);
    if (uid === null) return null;
    loot = { kind: 'furniture', uid, typeId: pick.typeId };
    change = { reason: 'shelf', removeFurniture: [uid], note: `on sale: ${pick.typeId}` };
  }
  const next = applyChange(state, change, at);
  if (!next) return null;
  return withShop(next, { slots: [...next.shop.slots, { ...ref, loot, price }] });
}

/** The change that puts loot back in the bag. */
function backToBag(loot: LootRef, note: string): Change {
  return loot.kind === 'material'
    ? { reason: 'shelf', materials: { [loot.id]: loot.qty }, note }
    : { reason: 'shelf', returnFurniture: [{ uid: loot.uid, typeId: loot.typeId }], note };
}

/** Takes the loot on a slot back to the bag. Null if the slot is empty. */
export function takeFromShelf(state: GameState, ref: ShelfSlotRef, at: number): GameState | null {
  const slot = slotAt(state.shop, ref);
  if (!slot?.loot) return null;
  const next = applyChange(state, backToBag(slot.loot, `off sale: ${lootTypeId(slot.loot)}`), at);
  if (!next) return null;
  return withShop(next, { slots: next.shop.slots.filter((s) => s !== slot) });
}

/** Changes the price of the loot on a slot. Null if the slot is empty or the price is not valid. */
export function setPrice(state: GameState, ref: ShelfSlotRef, price: number): GameState | null {
  const slot = slotAt(state.shop, ref);
  if (!slot?.loot || !validPrice(price)) return null;
  return withShop(state, { slots: state.shop.slots.map((s) => (s === slot ? { ...s, price } : s)) });
}

/**
 * Slots whose table, shelf or case is no longer placed in the shop (picked up, or sent back by
 * a room upgrade) give their loot back to the bag.
 */
export function returnOrphanLoot(state: GameState, at: number): GameState {
  let next = state;
  for (const slot of state.shop.slots) {
    if (isSlotOf(state, slot) || !slot.loot) continue;
    const r = applyChange(next, backToBag(slot.loot, `shelf gone: ${lootTypeId(slot.loot)}`), at);
    if (r) next = withShop(r, { slots: r.shop.slots.filter((s) => s !== slot) });
  }
  return next;
}

// ---------- Appeal and customers ----------

/**
 * shopAppeal = min(100, sum of the appeal of the placed items (each type counted at most 3
 * times) + the appeal of the floor and wall styles).
 */
export function shopAppeal(room: Room, items: readonly FurnitureItem[]): number {
  const counted = new Map<string, number>();
  let sum = 0;
  for (const i of items) {
    if (i.roomId !== room.id) continue;
    const n = counted.get(i.typeId) ?? 0;
    if (n >= APPEAL_MAX_PER_TYPE) continue;
    counted.set(i.typeId, n + 1);
    sum += getFurnitureType(i.typeId).appeal;
  }
  sum += styleAppeal('floor', room.floorStyle) + styleAppeal('wall', room.wallStyle);
  return Math.min(SHOP_APPEAL_MAX, sum);
}

/** ms between customers: 60 s * 100 / (100 + appeal). */
export function customerIntervalMs(appeal: number): number {
  return (CUSTOMER_BASE_INTERVAL_MS * CUSTOMER_APPEAL_BASE) / (CUSTOMER_APPEAL_BASE + appeal);
}

export function hasStock(shop: ShopState): boolean {
  return shop.slots.some((s) => s.loot !== null);
}

/** The categories that have stock, in SHOP_CATEGORIES order. */
export function stockedCategories(shop: ShopState): ShopCategory[] {
  const have = new Set(shop.slots.flatMap((s) => (s.loot ? [lootCategory(s.loot)] : [])));
  return SHOP_CATEGORIES.filter((c) => have.has(c));
}

/** 80% of the time a category with stock in this shop, otherwise any category. */
export function chooseCategory(shop: ShopState, rng: Rng): ShopCategory {
  const stocked = stockedCategories(shop);
  const roll = rng();
  const from = roll < CUSTOMER_STOCKED_CATEGORY_CHANCE && stocked.length > 0 ? stocked : SHOP_CATEGORIES;
  return from[Math.floor(rng() * from.length)] ?? from[0]!;
}

/** A tolerance in [0.8, 1.4]. */
export function rollTolerance(rng: Rng): number {
  return CUSTOMER_TOLERANCE_MIN + rng() * (CUSTOMER_TOLERANCE_MAX - CUSTOMER_TOLERANCE_MIN);
}

/** The cheapest filled slot in a category (ties: the first slot in shelf, index order), or null. */
export function cheapestIn(shop: ShopState, category: ShopCategory): ShopSlot | null {
  let best: ShopSlot | null = null;
  for (const s of shop.slots) {
    if (!s.loot || lootCategory(s.loot) !== category) continue;
    if (
      !best ||
      s.price < best.price ||
      (s.price === best.price && (s.shelfUid < best.shelfUid || (s.shelfUid === best.shelfUid && s.index < best.index)))
    ) {
      best = s;
    }
  }
  return best;
}

export interface Decision {
  buy: boolean;
  reaction: Reaction;
}

/**
 * Buys if price <= baseValue * tolerance. Reactions: bought at price <= 0.7 * baseValue *
 * tolerance: big smile (too cheap); bought higher: smile; refused at price <= 1.15 * baseValue *
 * tolerance: shrug; refused higher: frown.
 */
export function decide(price: number, baseValue: number, tolerance: number): Decision {
  const limit = baseValue * tolerance;
  if (price <= limit) return { buy: true, reaction: price <= REACTION_BIG_SMILE_MAX * limit ? 'big_smile' : 'smile' };
  return { buy: false, reaction: price <= REACTION_SHRUG_MAX * limit ? 'shrug' : 'frown' };
}

/** The sale history with one more price for a type (the last SALE_HISTORY_LENGTH kept). */
export function recordSale(history: Record<string, number[]>, typeId: string, price: number): Record<string, number[]> {
  return { ...history, [typeId]: [...(history[typeId] ?? []), price].slice(-SALE_HISTORY_LENGTH) };
}

export interface Visit {
  /** The cheapest slot in the wanted category (what the reaction is about), or null. */
  slot: ShopSlot | null;
  decision: Decision | null;
}

/** One customer looks at the cheapest item in the category they want and decides. */
export function visit(shop: ShopState, want: ShopCategory, tolerance: number): Visit {
  const slot = cheapestIn(shop, want);
  if (!slot?.loot) return { slot: null, decision: null };
  return { slot, decision: decide(slot.price, lootBaseValue(slot.loot), tolerance) };
}

/** The shop with a sold slot emptied. */
export function removeSlot(shop: ShopState, slot: ShopSlot): ShopState {
  return { ...shop, slots: shop.slots.filter((s) => !(s.shelfUid === slot.shelfUid && s.index === slot.index)) };
}

/** A customer who came during a break and took an item (maths only, no walking). */
export interface Arrival {
  want: ShopCategory;
  tolerance: number;
  loot: LootRef;
  price: number;
  /** ms after the shop's clock (updatedAt) when they came. */
  afterMs: number;
}

/**
 * The catch-up after a break (step 9d, maths only, no gold): customers arrive every
 * customerIntervalMs(appeal) while the shop has stock (the timer pauses while it is empty). Each
 * decides at once: a buyer takes the item (the slot empties) and joins the queue; one who refuses
 * just leaves. While QUEUE_MAX wait (counting `waiting`, those already in the line), nobody new
 * comes in and the timer starts again. elapsedMs is capped at OFFLINE_MAX_MS for the maths; the
 * clock moves by the real elapsedMs. The caller turns the arrivals into waiting customers.
 */
export function fillQueueMath(shop: ShopState, appeal: number, waiting: number, elapsedMs: number, rng: Rng): { shop: ShopState; arrivals: Arrival[] } {
  const elapsed = Math.max(0, elapsedMs);
  const span = Math.min(elapsed, OFFLINE_MAX_MS);
  const interval = customerIntervalMs(appeal);
  let s = shop;
  const arrivals: Arrival[] = [];
  let t = 0;
  let wait = s.nextCustomerInMs;
  while (hasStock(s)) {
    if (t + wait > span) {
      wait -= span - t;
      break;
    }
    t += wait;
    wait = interval;
    // A full line: nobody comes in (the timer just starts again).
    if (waiting + arrivals.length >= QUEUE_MAX) continue;
    const want = chooseCategory(s, rng);
    const tolerance = rollTolerance(rng);
    const v = visit(s, want, tolerance);
    if (v.slot?.loot && v.decision?.buy) {
      arrivals.push({ want, tolerance, loot: v.slot.loot, price: v.slot.price, afterMs: t });
      s = removeSlot(s, v.slot);
    }
  }
  return { shop: { ...s, nextCustomerInMs: wait, updatedAt: shop.updatedAt + elapsed }, arrivals };
}
